/**
 * React hook that orchestrates the inpainting worker for **object removal**.
 *
 * Same design as the Background Remover's hook (useBackgroundRemover):
 *  - The worker is created lazily (on `prepare()` when the editor opens, or on
 *    the first edit) and reused; the model downloads only on the first edit.
 *  - A monotonic `requestId` drops stale results.
 *  - The worker is terminated, and every object URL revoked, on unmount.
 *
 * Edits are non-destructive and stack: each result becomes the input for the
 * next one, and `undo()` steps back. The history is capped so memory stays
 * bounded (each entry is just a compressed PNG blob, not raw pixels).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InferenceDevice, InpaintResponse, ModelFileProgress, WebGpuSupport } from './types'

export type ObjectRemoverStatus =
  | 'idle'
  | 'loading-model'
  | 'inpainting'
  | 'done'
  | 'error'

/** One finished edit: a PNG blob plus its object URL and size. */
export interface Edit {
  blob: Blob
  url: string
  width: number
  height: number
}

/**
 * Max edits kept in memory. Once older edits are evicted, the oldest one still
 * kept becomes the undo floor, so undo never jumps back past evicted steps to
 * the original image.
 */
const MAX_HISTORY = 10

export interface UseObjectRemover {
  status: ObjectRemoverStatus
  support: WebGpuSupport
  device: InferenceDevice | null
  progress: ModelFileProgress[]
  /** Latest edit, or null when the image is untouched. */
  current: Edit | null
  /** Number of edits applied to the image (including ones evicted from history). */
  editCount: number
  /** Whether `undo()` can step back (false at the original or at the undo floor). */
  canUndo: boolean
  error: string | null
  /** Spin up the worker and probe WebGPU (no model download). */
  prepare: () => void
  /** Fill the masked area (255 = keep, 0 = fill) of the image at `imageUrl`. */
  inpaint: (imageUrl: string, width: number, height: number, mask: Uint8Array) => void
  undo: () => void
  /** Drop all edits (keeps the model loaded). */
  reset: () => void
}

function revoke(edit: Edit | null | undefined): void {
  if (edit) URL.revokeObjectURL(edit.url)
}

export function useObjectRemover(): UseObjectRemover {
  const workerRef = useRef<Worker | null>(null)
  const [status, setStatus] = useState<ObjectRemoverStatus>('idle')
  const [support, setSupport] = useState<WebGpuSupport>({ checked: false, webgpu: false })
  const [device, setDevice] = useState<InferenceDevice | null>(null)
  const [progress, setProgress] = useState<ModelFileProgress[]>([])
  const [history, setHistory] = useState<Edit[]>([])
  const [error, setError] = useState<string | null>(null)

  // How many of the oldest edits were evicted from `history`. While > 0, the
  // first kept entry is the undo floor (the original is no longer reachable).
  const [evicted, setEvicted] = useState(0)

  const requestIdRef = useRef(0)
  // Mirrors of `history` / `evicted` for unmount cleanup and message handlers.
  const historyRef = useRef<Edit[]>([])
  const evictedRef = useRef(0)

  const commitHistory = useCallback((next: Edit[], nextEvicted: number) => {
    historyRef.current = next
    evictedRef.current = nextEvicted
    setHistory(next)
    setEvicted(nextEvicted)
  }, [])

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })

    // A hard worker failure (the module failed to load, an uncaught error, or a
    // message that could not be deserialized) never arrives as a normal
    // 'message', so without this the UI would stay stuck in a loading state.
    // Drop the broken worker and show the error; the next removal creates a
    // fresh worker, so the user can simply retry.
    const fail = (message: string) => {
      if (workerRef.current !== worker) return
      worker.terminate()
      workerRef.current = null
      requestIdRef.current++ // nothing from the dead worker may land later
      setProgress([])
      setError(message)
      setStatus('error')
    }
    worker.addEventListener('error', (e) => {
      const detail = e.message ? ` (${e.message})` : ''
      fail(`The inpainting worker stopped unexpectedly${detail}. Please try again.`)
    })
    worker.addEventListener('messageerror', () => {
      fail('The inpainting worker sent a message that could not be read. Please try again.')
    })

    worker.addEventListener('message', (event: MessageEvent<InpaintResponse>) => {
      const msg = event.data
      switch (msg.status) {
        case 'check-result':
          setSupport({ checked: true, webgpu: msg.webgpu })
          break
        case 'loading':
          setStatus('loading-model')
          break
        case 'progress':
          setProgress((prev) => {
            const next = prev.filter((p) => p.file !== msg.file.file)
            next.push(msg.file)
            return next
          })
          break
        case 'ready':
          setDevice(msg.device)
          break
        case 'inpainting':
          if (msg.requestId !== requestIdRef.current) break
          setDevice(msg.device)
          setStatus('inpainting')
          break
        case 'complete': {
          if (msg.requestId !== requestIdRef.current) break
          const edit: Edit = {
            blob: msg.blob,
            url: URL.createObjectURL(msg.blob),
            width: msg.width,
            height: msg.height,
          }
          const next = [...historyRef.current, edit]
          let nextEvicted = evictedRef.current
          // Evict (and revoke) the oldest entries beyond the cap.
          while (next.length > MAX_HISTORY) {
            revoke(next.shift())
            nextEvicted++
          }
          commitHistory(next, nextEvicted)
          setStatus('done')
          break
        }
        case 'error':
          if (msg.requestId !== null && msg.requestId !== requestIdRef.current) break
          setError(msg.message)
          setStatus('error')
          break
      }
    })

    workerRef.current = worker
    worker.postMessage({ type: 'check' })
    return worker
  }, [commitHistory])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
      historyRef.current.forEach(revoke)
      historyRef.current = []
    }
  }, [])

  const prepare = useCallback(() => {
    ensureWorker()
  }, [ensureWorker])

  const inpaint = useCallback(
    (imageUrl: string, width: number, height: number, mask: Uint8Array) => {
      const worker = ensureWorker()
      const requestId = ++requestIdRef.current
      setError(null)
      setProgress([])
      setStatus('loading-model') // flips to 'inpainting' via messages
      // Transfer the mask buffer instead of copying it.
      worker.postMessage({ type: 'inpaint', requestId, image: imageUrl, width, height, mask }, [
        mask.buffer,
      ])
    },
    [ensureWorker],
  )

  const undo = useCallback(() => {
    const prev = historyRef.current
    // At the undo floor: older edits were evicted, so keep the oldest one left.
    const floor = evictedRef.current > 0 ? 1 : 0
    if (prev.length <= floor) return
    requestIdRef.current++ // discard anything in flight
    const next = prev.slice(0, -1)
    revoke(prev[prev.length - 1])
    commitHistory(next, evictedRef.current)
    setError(null)
    setStatus(next.length ? 'done' : 'idle')
  }, [commitHistory])

  const reset = useCallback(() => {
    requestIdRef.current++
    historyRef.current.forEach(revoke)
    commitHistory([], 0)
    setError(null)
    setProgress([])
    setStatus('idle')
  }, [commitHistory])

  return {
    status,
    support,
    device,
    progress,
    current: history[history.length - 1] ?? null,
    editCount: evicted + history.length,
    canUndo: history.length > (evicted > 0 ? 1 : 0),
    error,
    prepare,
    inpaint,
    undo,
    reset,
  }
}

/**
 * Trigger a browser download of a blob as `filename`. Creates and revokes a
 * temporary object URL so nothing leaks.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Derive "<name>-edited.png" from the source filename. */
export function editedFilename(sourceName: string | null | undefined): string {
  const base = (sourceName ?? 'image').replace(/\.[^.]+$/, '').trim() || 'image'
  return `${base}-edited.png`
}
