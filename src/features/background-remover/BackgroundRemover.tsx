import { useCallback, useEffect, useRef, useState } from 'react'
import { Scissors, Sparkles, RotateCcw, X, Loader2, Download, Info, ImageDown } from 'lucide-react'
import { FeaturePanel } from '../../components/ui/FeaturePanel'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'
import { Dropzone } from './components/Dropzone'
import { ModelStatus } from './components/ModelStatus'
import { BeforeAfter } from './components/BeforeAfter'
import {
  useBackgroundRemover,
  prepareImage,
  releaseImage,
  downloadBlob,
  cutoutFilename,
} from './useBackgroundRemover'
import { loadSampleFile } from './sample'
import { MODEL_ID } from './types'

/** The uploaded source image: preview URL, dimensions, and original filename. */
interface SourceImage {
  url: string
  width: number
  height: number
  name: string
}

export function BackgroundRemover() {
  const { status, support, device, progress, cutout, error, segment, reset } =
    useBackgroundRemover()

  const [source, setSource] = useState<SourceImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // Keep the current source URL in a ref so unmount cleanup can revoke it.
  const sourceUrlRef = useRef<string | null>(null)
  useEffect(() => {
    sourceUrlRef.current = source?.url ?? null
  }, [source])
  useEffect(() => {
    return () => releaseImage(sourceUrlRef.current)
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setImageError(null)
      reset()
      try {
        const prepared = await prepareImage(file)
        // Swap in the new source, revoking the previous preview URL.
        releaseImage(sourceUrlRef.current)
        setSource({
          url: prepared.url,
          width: prepared.width,
          height: prepared.height,
          name: file.name,
        })
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Could not load that image.')
      }
    },
    [reset],
  )

  const handleSample = useCallback(async () => {
    setImageError(null)
    try {
      const file = await loadSampleFile()
      await handleFile(file)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not load the sample photo.')
    }
  }, [handleFile])

  const handleRemove = useCallback(() => {
    if (!source) return
    segment(source.url, source.width, source.height)
  }, [segment, source])

  const handleReset = useCallback(() => {
    releaseImage(sourceUrlRef.current)
    setSource(null)
    setImageError(null)
    reset()
  }, [reset])

  const handleDownload = useCallback(() => {
    if (!cutout) return
    downloadBlob(cutout.blob, cutoutFilename(source?.name))
  }, [cutout, source])

  const busy =
    status === 'loading-model' || status === 'segmenting' || status === 'compositing'
  const hasResult = status === 'done' && cutout !== null

  const buttonLabel = (() => {
    if (status === 'loading-model') return 'Loading model…'
    if (status === 'segmenting') return 'Removing background…'
    if (status === 'compositing') return 'Finishing…'
    return hasResult ? 'Run again' : 'Remove Background'
  })()

  const aspectRatio = source ? source.width / source.height : 1

  return (
    <FeaturePanel
      icon={Scissors}
      title="AI Background Remover"
      description="Upload an image, strip its background with a local AI model, and download a transparent PNG — fully on-device."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge>RMBG-1.4</Badge>
          <Badge>Transformers.js v4</Badge>
          <Badge>WebGPU</Badge>
          <Badge>100% on-device</Badge>
          <Badge>Non-commercial model</Badge>
        </div>

        {!source ? (
          <>
            <Dropzone onFile={handleFile} disabled={busy} />
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSample}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-100 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ImageDown className="size-4" aria-hidden="true" />
                Upload sample photo
              </button>
            </div>
            {imageError && (
              <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {imageError}
              </p>
            )}
          </>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            {/* Left column: preview / comparison. */}
            <div className="space-y-3">
              {hasResult && cutout ? (
                <BeforeAfter
                  beforeUrl={source.url}
                  afterUrl={cutout.url}
                  aspectRatio={aspectRatio}
                />
              ) : (
                <div
                  className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/30"
                  style={{ aspectRatio: String(aspectRatio) }}
                >
                  <img
                    src={source.url}
                    alt="Uploaded image"
                    className="absolute inset-0 size-full object-contain"
                  />
                  {!busy && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/60 px-2 py-1 text-xs text-gray-200 backdrop-blur transition-colors hover:bg-black/80"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
              )}

              {/* Standalone preview of the result on a checkerboard. */}
              {hasResult && cutout && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400">Result</p>
                  <div
                    className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-[length:20px_20px] [background-image:conic-gradient(#2a2a33_90deg,transparent_90deg_180deg,#2a2a33_180deg_270deg,transparent_270deg)] [background-position:0_0,10px_10px]"
                    style={{ aspectRatio: String(aspectRatio) }}
                  >
                    <img
                      src={cutout.url}
                      alt="Background removed"
                      className="absolute inset-0 size-full object-contain"
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                {source.width}×{source.height}px
                {hasResult ? ' · drag the slider to compare' : ''}
              </p>

              {imageError && (
                <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {imageError}
                </p>
              )}
            </div>

            {/* Right column: actions, status, download. */}
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                    'bg-indigo-500 text-white hover:bg-indigo-400',
                    'disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500',
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-4" aria-hidden="true" />
                  )}
                  {buttonLabel}
                </button>

                {!busy && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>

              {/* Download — only enabled once a valid cut-out exists. */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!hasResult}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  hasResult
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'cursor-not-allowed bg-white/10 text-gray-500',
                )}
              >
                <Download className="size-4" aria-hidden="true" />
                Download Transparent PNG
              </button>

              {/* Model status / download progress. */}
              {(busy || support.checked) && (
                <ModelStatus
                  status={status}
                  support={support}
                  device={device}
                  progress={progress}
                  modelId={MODEL_ID}
                />
              )}

              {/* Inference error. */}
              {status === 'error' && error && (
                <div className="space-y-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-200">
                  <p className="font-medium">Background removal failed</p>
                  <p className="text-rose-300/90">{error}</p>
                  <p className="text-xs text-rose-300/70">
                    This can happen if the browser lacks WebGPU and has insufficient memory for
                    the CPU fallback. Try a Chromium-based desktop browser with WebGPU enabled.
                  </p>
                </div>
              )}

              {hasResult && (
                <div className="flex items-start gap-2 rounded-md border border-sky-400/20 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-200/90">
                  <Info className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
                  <p>
                    The PNG is exported at the source resolution ({cutout?.width}×{cutout?.height}px)
                    with a real alpha channel. Fine edges like hair, or transparent and reflective
                    objects, can still confuse the model — review before using.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </FeaturePanel>
  )
}

export default BackgroundRemover
