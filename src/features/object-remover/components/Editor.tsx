import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eraser, Info, Loader2, RotateCcw, Undo2, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { INPAINT_MODEL_REPO } from '../types'
import { downloadBlob, editedFilename, type UseObjectRemover } from '../useObjectRemover'
import { BeforeAfter } from './BeforeAfter'
import { MaskPainter, type MaskPainterHandle } from './MaskPainter'
import { ModelStatus } from './ModelStatus'

interface EditorProps {
  /** The untouched upload (used for "compare with original"). */
  original: { url: string; width: number; height: number; name: string }
  remover: UseObjectRemover
  /** Drop the image and all edits and start over. */
  onReset: () => void
}

/**
 * Editing view: paint over anything unwanted, run the inpainting model,
 * repeat. Each result becomes the new working image; Undo steps back.
 */
export function Editor({ original, remover, onReset }: EditorProps) {
  const { status, support, device, progress, current, editCount, error, prepare, inpaint, undo } =
    remover

  const painterRef = useRef<MaskPainterHandle>(null)
  const [brushSize, setBrushSize] = useState(32)
  const [hasSelection, setHasSelection] = useState(false)

  // Opening the editor spins up the worker and probes WebGPU — no download yet.
  useEffect(() => {
    prepare()
  }, [prepare])

  const working = current ?? original
  const busy = status === 'loading-model' || status === 'inpainting'

  const handleRemove = useCallback(() => {
    const mask = painterRef.current?.getMask()
    if (!mask) return
    inpaint(working.url, working.width, working.height, mask)
  }, [inpaint, working])

  const handleDownload = useCallback(() => {
    if (current) downloadBlob(current.blob, editedFilename(original.name))
  }, [current, original.name])

  const buttonLabel =
    status === 'loading-model'
      ? 'Loading model…'
      : status === 'inpainting'
        ? 'Removing…'
        : 'Remove selected'

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      {/* Left column: same flow as the Background Remover — the image first;
          once there is a result, the before/after slider on top and the result
          below. The result is also the paint surface for the next removal. */}
      <div className="space-y-3">
        {current && (
          <BeforeAfter
            beforeUrl={original.url}
            afterUrl={current.url}
            aspectRatio={original.width / original.height}
          />
        )}

        <div className="space-y-1.5">
          {current && <p className="text-xs font-medium text-gray-400">Result</p>}
          <div className="relative">
            <MaskPainter
              ref={painterRef}
              imageUrl={working.url}
              width={working.width}
              height={working.height}
              brushSize={brushSize}
              disabled={busy}
              onPaintedChange={setHasSelection}
            />
            {busy && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                <Loader2 className="size-8 animate-spin text-white" aria-hidden="true" />
              </div>
            )}
            {!current && !busy && (
              <button
                type="button"
                onClick={onReset}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/60 px-2 py-1 text-xs text-gray-200 backdrop-blur transition-colors hover:bg-black/80"
              >
                <X className="size-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {working.width}×{working.height}px
          {current
            ? ' · drag the slider to compare · paint on the result to remove more'
            : ' · paint over what you want to remove'}
          {editCount > 0 ? ` · ${editCount} edit${editCount === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="brush-size"
            className="flex justify-between text-xs font-medium text-gray-400"
          >
            <span>Brush size</span>
            <span className="tabular-nums">{brushSize}px</span>
          </label>
          <input
            id="brush-size"
            type="range"
            min={8}
            max={120}
            step={2}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full accent-indigo-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy || !hasSelection}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
              'bg-indigo-500 text-white hover:bg-indigo-400',
              'disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500',
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Eraser className="size-4" aria-hidden="true" />
            )}
            {buttonLabel}
          </button>

          <button
            type="button"
            onClick={() => painterRef.current?.clear()}
            disabled={busy || !hasSelection}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
            Clear selection
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={busy || editCount === 0}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Undo
          </button>
          {!busy && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!current || busy}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
            current && !busy
              ? 'bg-emerald-500 text-white hover:bg-emerald-400'
              : 'cursor-not-allowed bg-white/10 text-gray-500',
          )}
        >
          <Download className="size-4" aria-hidden="true" />
          Download Edited PNG
        </button>

        {(busy || support.checked) && (
          <ModelStatus
            status={status}
            support={support}
            device={device}
            progress={progress}
            modelId={INPAINT_MODEL_REPO}
          />
        )}

        {status === 'error' && error && (
          <div className="space-y-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-200">
            <p className="font-medium">Object removal failed</p>
            <p className="text-rose-300/90">{error}</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-sky-400/20 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-200/90">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
          <p>
            Cover the whole object, including its shadow and reflection — a few pixels of
            margin are added automatically. Only the selected area changes; everything else
            stays identical.
          </p>
        </div>
      </div>
    </div>
  )
}
