/**
 * Type definitions for the AI Object Remover (inpainting).
 *
 * Mirrors the layout of the Background Remover's types:
 *  1. The model location (single source of truth, shared by worker + UI).
 *  2. The messages exchanged with the inference Web Worker.
 *  3. Per-file download progress for the model status UI.
 */

/**
 * Inpainting model: **LaMa** (big-lama, Suvorov et al., WACV 2022) as a
 * weight-quantized ONNX export made for onnxruntime-web.
 *
 *  - Apache-2.0. Derived from `Carve/LaMa-ONNX` (`lama_fp32.onnx`, 208 MB) with
 *    the convolution weights stored as int4/int8, so the download is ~37 MB
 *    (36,931,151 bytes). The `_r4` file rewrites the Fourier units to rank ≤ 4
 *    tensors so it also compiles on Firefox's WebGPU.
 *  - Weights are de-quantized to fp32 once at load time (see
 *    `disable_quant_qdq` in the worker), so inference matches the fp32 model.
 *  - Chosen over MI-GAN (28 MB) after a side-by-side test: on a crumpled tissue
 *    on a desk, MI-GAN left a smudge and invented a streak; LaMa continued the
 *    wall and desk.
 *  - I/O (read from the ONNX graph, not assumed):
 *      image  float32 [1, 3, 512, 512]  RGB / 255
 *      mask   float32 [1, 1, 512, 512]  1 = fill, 0 = keep
 *      output float32 [1, 3, 512, 512]  RGB in [0, 255]
 *    The input size is fixed, so the worker crops around the selection,
 *    resizes that crop to 512×512, and pastes the fill back.
 *
 *   https://huggingface.co/othytenk/lama-int4-int8
 *   https://huggingface.co/Carve/LaMa-ONNX
 *   https://github.com/advimman/lama
 */
export const INPAINT_MODEL_REPO = 'othytenk/lama-int4-int8'

/**
 * Pinned to an exact commit so the bytes can never change under a cached copy
 * (and the CacheFirst service-worker rule stays correct forever).
 */
export const INPAINT_MODEL_REVISION = 'b52ebb642126086fe3da1524a3b1d7629ae4c6a9'

export const INPAINT_MODEL_FILE = 'lama_int4_int8_r4.onnx'

export const INPAINT_MODEL_URL = `https://huggingface.co/${INPAINT_MODEL_REPO}/resolve/${INPAINT_MODEL_REVISION}/${INPAINT_MODEL_FILE}`

/** SHA-256 of the pinned file (matches the Hub LFS pointer and the model card). */
export const INPAINT_MODEL_SHA256 =
  '4e3b78a253eb4abf21896811c928ffa91214b916e5d6ced24cecdd7999b4aaa1'

/** LaMa's fixed input resolution. */
export const INPAINT_SIZE = 512

// ---------------------------------------------------------------------------
// Worker message protocol
// ---------------------------------------------------------------------------

/** Per-file model download progress. */
export interface ModelFileProgress {
  file: string
  /** 0–100, present once the total size is known. */
  progress?: number
  loaded?: number
  total?: number
}

/** Device the model ended up running on. */
export type InferenceDevice = 'webgpu' | 'wasm'

/** Result of the (cheap, download-free) WebGPU probe. */
export interface WebGpuSupport {
  checked: boolean
  webgpu: boolean
}

/** Messages sent from the UI thread to the inpainting worker. */
export type InpaintRequest =
  | { type: 'check' }
  | {
      type: 'inpaint'
      /** Monotonic id so stale results can be discarded by the UI. */
      requestId: number
      /** Object URL of the image to edit (same origin, readable by the worker). */
      image: string
      width: number
      height: number
      /**
       * Single-channel selection, length `width * height`: 255 = keep,
       * 0 = remove/fill. Sent as a transferable buffer.
       */
      mask: Uint8Array
    }

/** Messages sent from the inpainting worker back to the UI thread. */
export type InpaintResponse =
  | { status: 'check-result'; webgpu: boolean }
  | { status: 'loading'; message: string }
  | { status: 'progress'; file: ModelFileProgress }
  | { status: 'ready'; device: InferenceDevice }
  | { status: 'inpainting'; device: InferenceDevice; requestId: number }
  /** The edited image for `requestId`, already PNG-encoded in the worker. */
  | { status: 'complete'; requestId: number; blob: Blob; width: number; height: number }
  | { status: 'error'; requestId: number | null; message: string }
