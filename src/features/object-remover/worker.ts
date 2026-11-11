/// <reference lib="webworker" />
/**
 * Inference Web Worker for the AI Object Remover (inpainting).
 *
 * Same shape as the Background Remover's worker: the model lives off the main
 * thread, loads lazily on first use, and is reused for every later edit.
 *
 * Lifecycle messages (see ./types):
 *   check   -> report WebGPU availability (cheap, no model download)
 *   inpaint -> fill the masked region of the given image, reply with a PNG blob
 *
 * Why ONNX Runtime Web directly instead of Transformers.js: LaMa is a plain
 * ONNX graph with no Hugging Face `config.json` / processor, so there is no
 * Transformers.js model class for it. `onnxruntime-web` is the same runtime
 * Transformers.js already ships (pinned to the exact same version in
 * package.json, so nothing new is downloaded or bundled twice per worker).
 *
 * WASM runtime files: we deliberately do NOT set `ort.env.wasm.wasmPaths`. The
 * default `onnxruntime-web/webgpu` entry references its .wasm next to itself, so
 * Vite emits it into the build and the PWA precaches it — the runtime is served
 * from our own origin and works offline, with no CDN involved.
 */

import * as ort from 'onnxruntime-web/webgpu'

import type { InferenceDevice, InpaintRequest, InpaintResponse } from './types'
import {
  INPAINT_MODEL_FILE,
  INPAINT_MODEL_SHA256,
  INPAINT_MODEL_URL,
  INPAINT_SIZE,
} from './types'

/** Cache Storage bucket for the model bytes (same idea as Transformers.js's own cache). */
const MODEL_CACHE = 'object-remover-models'

function reply(message: InpaintResponse, transfer?: Transferable[]): void {
  if (transfer) self.postMessage(message, transfer)
  else self.postMessage(message)
}

/** Detect WebGPU support. Never throws. */
async function detectWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu
    if (!gpu) return false
    const adapter = await gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Return the model bytes: from Cache Storage when present (offline-capable),
 * otherwise download once with progress, verify the SHA-256, and cache.
 *
 * Integrity matters because the bytes are executed by the runtime: a truncated
 * or tampered download is rejected instead of being cached forever.
 */
async function loadModelBytes(): Promise<Uint8Array> {
  const cache = 'caches' in self ? await caches.open(MODEL_CACHE).catch(() => null) : null

  const cached = await cache?.match(INPAINT_MODEL_URL)
  if (cached) {
    return new Uint8Array(await cached.arrayBuffer())
  }

  const res = await fetch(INPAINT_MODEL_URL)
  if (!res.ok || !res.body) {
    throw new Error(`Could not download the inpainting model (HTTP ${res.status}).`)
  }

  const total = Number(res.headers.get('content-length')) || undefined
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    reply({
      status: 'progress',
      file: {
        file: INPAINT_MODEL_FILE,
        loaded,
        total,
        progress: total ? (loaded / total) * 100 : undefined,
      },
    })
  }

  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  chunks.length = 0

  const digest = toHex(await crypto.subtle.digest('SHA-256', bytes))
  if (digest !== INPAINT_MODEL_SHA256) {
    throw new Error('The downloaded inpainting model failed its integrity check. Please retry.')
  }

  // Best effort: a full or unavailable cache must not break the feature.
  await cache
    ?.put(
      INPAINT_MODEL_URL,
      new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }),
    )
    .catch(() => undefined)

  reply({
    status: 'progress',
    file: { file: INPAINT_MODEL_FILE, loaded, total: loaded, progress: 100 },
  })
  return bytes
}

async function createSession(
  bytes: Uint8Array,
  device: InferenceDevice,
): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(bytes, {
    executionProviders: [device],
    // Required by this export (see its model card): fold every
    // DequantizeLinear -> Reshape weight chain into plain fp32 once at load,
    // so inference runs exactly like the fp32 model.
    extra: { session: { disable_quant_qdq: '1' } },
    // 3 = errors only. At the default level ORT logs a harmless "some nodes
    // were not assigned to the preferred execution provider" notice (shape ops
    // deliberately run on CPU) through console.error, which looks like a failure.
    logSeverityLevel: 3,
  })
}

/**
 * Lazy singleton holding the ONNX session. Concurrent first calls share one
 * in-flight promise so the model can never be downloaded twice.
 */
class Inpainter {
  private static instance: Inpainter | null = null
  private static loading: Promise<Inpainter> | null = null

  session: ort.InferenceSession
  device: InferenceDevice

  private constructor(session: ort.InferenceSession, device: InferenceDevice) {
    this.session = session
    this.device = device
  }

  static current(): Inpainter | null {
    return Inpainter.instance
  }

  static async get(): Promise<Inpainter> {
    if (Inpainter.instance) return Inpainter.instance
    if (Inpainter.loading) return Inpainter.loading

    Inpainter.loading = (async () => {
      const bytes = await loadModelBytes()
      const webgpu = await detectWebGpu()
      let session: ort.InferenceSession | null = null
      let device: InferenceDevice = 'wasm'
      if (webgpu) {
        try {
          session = await createSession(bytes, 'webgpu')
          device = 'webgpu'
        } catch {
          // Some GPUs/drivers reject an op; fall back to CPU rather than fail.
          session = null
        }
      }
      if (!session) session = await createSession(bytes, 'wasm')
      Inpainter.instance = new Inpainter(session, device)
      return Inpainter.instance
    })()

    try {
      return await Inpainter.loading
    } finally {
      Inpainter.loading = null
    }
  }

  /** Swap a failing WebGPU session for a CPU one (used if a run fails on GPU). */
  async fallBackToWasm(): Promise<void> {
    const bytes = await loadModelBytes()
    const old = this.session
    this.session = await createSession(bytes, 'wasm')
    this.device = 'wasm'
    await old.release().catch(() => undefined)
  }
}

/** Decode the (same-origin blob) image into RGBA pixels at exactly width×height. */
async function readPixels(
  url: string,
  width: number,
  height: number,
): Promise<{ canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D; data: ImageData }> {
  const blob = await (await fetch(url)).blob()
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('OffscreenCanvas 2D is unavailable in this browser.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return { canvas, ctx, data: ctx.getImageData(0, 0, width, height) }
  } finally {
    bitmap.close()
  }
}

/**
 * Mask growth: people rarely paint exactly to an object's edge, and object
 * pixels left just outside the hole get smeared into the fill as a "ghost".
 * This adds a small automatic margin.
 */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length)
  const out = new Uint8Array(mask.length)
  const prefix = new Int32Array(Math.max(w, h) + 1)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) prefix[x + 1] = prefix[x] + mask[row + x]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = prefix[Math.min(w, x + r + 1)] - prefix[Math.max(0, x - r)] > 0 ? 1 : 0
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) prefix[y + 1] = prefix[y] + tmp[y * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = prefix[Math.min(h, y + r + 1)] - prefix[Math.max(0, y - r)] > 0 ? 1 : 0
    }
  }
  return out
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Pick the region LaMa will see. LaMa only takes 512×512, so we give it a
 * square crop centred on the hole with about as much surrounding context as the
 * hole itself (2× the hole's longest side, at least 512 px), limited by the
 * image's shorter side so it stays square — on a small photo the square is
 * simply scaled *up* to 512. Only a hole larger than the shorter side makes the
 * crop non-square (and slightly stretched).
 */
function chooseCrop(hole: Uint8Array, w: number, h: number): Rect | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      if (!hole[i]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const square = Math.min(Math.max(2 * Math.max(bw, bh), INPAINT_SIZE), w, h)
  const cw = Math.max(square, bw)
  const ch = Math.max(square, bh)
  const cx = (x0 + x1 + 1) / 2
  const cy = (y0 + y1 + 1) / 2
  return {
    x: Math.round(Math.min(Math.max(cx - cw / 2, 0), w - cw)),
    y: Math.round(Math.min(Math.max(cy - ch / 2, 0), h - ch)),
    w: cw,
    h: ch,
  }
}

async function run(inpainter: Inpainter, image: Float32Array, mask: Float32Array) {
  const S = INPAINT_SIZE
  const imageTensor = new ort.Tensor('float32', image, [1, 3, S, S])
  const maskTensor = new ort.Tensor('float32', mask, [1, 1, S, S])
  try {
    const out = await inpainter.session.run({ image: imageTensor, mask: maskTensor })
    const result = out.output
    const data = (await result.getData()) as Float32Array
    result.dispose()
    return data
  } finally {
    imageTensor.dispose()
    maskTensor.dispose()
  }
}

let busy = false

async function inpaint(
  requestId: number,
  url: string,
  width: number,
  height: number,
  selection: Uint8Array,
): Promise<void> {
  if (busy) {
    reply({ status: 'error', requestId, message: 'Another edit is still running. Please wait.' })
    return
  }
  busy = true
  try {
    if (selection.length !== width * height) {
      throw new Error('Mask size does not match the image.')
    }

    const wasLoaded = Inpainter.current() != null
    if (!wasLoaded) reply({ status: 'loading', message: 'Downloading the inpainting model…' })
    const inpainter = await Inpainter.get()
    if (!wasLoaded) reply({ status: 'ready', device: inpainter.device })

    reply({ status: 'inpainting', device: inpainter.device, requestId })

    // 1. Hole = painted pixels, grown by a small margin that scales with size
    //    (4 px at 1344 px wide, 7 px at the 2048 px cap).
    const raw = new Uint8Array(selection.length)
    for (let i = 0; i < raw.length; i++) raw[i] = selection[i] === 0 ? 1 : 0
    const hole = dilate(raw, width, height, Math.max(3, Math.round(Math.max(width, height) / 300)))

    const crop = chooseCrop(hole, width, height)
    if (!crop) throw new Error('Nothing is selected.')

    const { canvas, ctx, data: imageData } = await readPixels(url, width, height)
    const S = INPAINT_SIZE

    // 2. Crop -> 512×512, as planar float RGB / 255.
    const small = new OffscreenCanvas(S, S)
    const sctx = small.getContext('2d', { willReadFrequently: true })
    if (!sctx) throw new Error('OffscreenCanvas 2D is unavailable in this browser.')
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, S, S)
    const sp = sctx.getImageData(0, 0, S, S).data
    const plane = S * S
    const input = new Float32Array(3 * plane)
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
      input[i] = sp[p] / 255
      input[plane + i] = sp[p + 1] / 255
      input[2 * plane + i] = sp[p + 2] / 255
    }

    // 3. Mask -> 512×512, conservatively: each TARGET pixel is a hole if ANY
    //    source pixel under it is a hole. Iterating targets (not sources) is what
    //    makes this correct when a small crop is scaled UP — mapping each source
    //    pixel to one target leaves gaps, and LaMa then copies the object back
    //    through them. A summed-area table makes each lookup O(1).
    const sat = new Int32Array((crop.w + 1) * (crop.h + 1))
    for (let y = 0; y < crop.h; y++) {
      let rowSum = 0
      const row = (crop.y + y) * width + crop.x
      for (let x = 0; x < crop.w; x++) {
        rowSum += hole[row + x]
        sat[(y + 1) * (crop.w + 1) + x + 1] = sat[y * (crop.w + 1) + x + 1] + rowSum
      }
    }
    const mask = new Float32Array(plane)
    for (let ty = 0; ty < S; ty++) {
      const sy0 = Math.floor((ty * crop.h) / S)
      const sy1 = Math.max(sy0 + 1, Math.ceil(((ty + 1) * crop.h) / S))
      for (let tx = 0; tx < S; tx++) {
        const sx0 = Math.floor((tx * crop.w) / S)
        const sx1 = Math.max(sx0 + 1, Math.ceil(((tx + 1) * crop.w) / S))
        const W1 = crop.w + 1
        const sum = sat[sy1 * W1 + sx1] - sat[sy0 * W1 + sx1] - sat[sy1 * W1 + sx0] + sat[sy0 * W1 + sx0]
        if (sum > 0) mask[ty * S + tx] = 1
      }
    }

    let out: Float32Array
    try {
      out = await run(inpainter, input, mask)
    } catch (err) {
      if (inpainter.device !== 'webgpu') throw err
      await inpainter.fallBackToWasm()
      reply({ status: 'inpainting', device: inpainter.device, requestId })
      out = await run(inpainter, input, mask)
    }

    // 4. 512×512 fill -> back to the crop's size.
    const fill = new ImageData(S, S)
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
      fill.data[p] = out[i] // Uint8ClampedArray rounds + clamps to 0–255
      fill.data[p + 1] = out[plane + i]
      fill.data[p + 2] = out[2 * plane + i]
      fill.data[p + 3] = 255
    }
    sctx.putImageData(fill, 0, 0)
    const back = new OffscreenCanvas(crop.w, crop.h)
    const bctx = back.getContext('2d', { willReadFrequently: true })
    if (!bctx) throw new Error('OffscreenCanvas 2D is unavailable in this browser.')
    bctx.imageSmoothingQuality = 'high'
    bctx.drawImage(small, 0, 0, crop.w, crop.h)
    const bp = bctx.getImageData(0, 0, crop.w, crop.h).data

    // 5. Write back ONLY hole pixels. Everything else stays bit-identical to
    //    the input (lossless), and the original alpha is kept.
    const px = imageData.data
    for (let y = 0; y < crop.h; y++) {
      for (let x = 0; x < crop.w; x++) {
        const i = (crop.y + y) * width + crop.x + x
        if (!hole[i]) continue
        const p = i * 4
        const q = (y * crop.w + x) * 4
        px[p] = bp[q]
        px[p + 1] = bp[q + 1]
        px[p + 2] = bp[q + 2]
      }
    }
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })

    // A Blob is passed by reference — no pixel copy crosses the thread boundary.
    reply({ status: 'complete', requestId, blob, width, height })
  } catch (err) {
    reply({ status: 'error', requestId, message: err instanceof Error ? err.message : String(err) })
  } finally {
    busy = false
  }
}

self.addEventListener('message', (event: MessageEvent<InpaintRequest>) => {
  const data = event.data
  switch (data.type) {
    case 'check':
      void detectWebGpu().then((webgpu) => reply({ status: 'check-result', webgpu }))
      break
    case 'inpaint':
      void inpaint(data.requestId, data.image, data.width, data.height, data.mask)
      break
  }
})
