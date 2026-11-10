import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, ImageDown } from 'lucide-react'
import { FeaturePanel } from '../../components/ui/FeaturePanel'
import { Badge } from '../../components/ui/Badge'
import { Dropzone } from './components/Dropzone'
import { Editor } from './components/Editor'
import { prepareImage, releaseImage } from './image'
import { loadSampleFile } from './sample'
import { useObjectRemover } from './useObjectRemover'

/** The uploaded source image: preview URL, dimensions, and original filename. */
interface SourceImage {
  url: string
  width: number
  height: number
  name: string
}

/**
 * AI Object Remover: upload a photo, paint over anything unwanted, and a local
 * inpainting model (LaMa) fills it in. Fully on-device — see ./worker.
 */
export function ObjectRemover() {
  const remover = useObjectRemover()
  const resetEdits = remover.reset
  const busy = remover.status === 'loading-model' || remover.status === 'inpainting'

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
      resetEdits()
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
    [resetEdits],
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

  const handleReset = useCallback(() => {
    releaseImage(sourceUrlRef.current)
    setSource(null)
    setImageError(null)
    resetEdits()
  }, [resetEdits])

  return (
    <FeaturePanel
      icon={Eraser}
      title="AI Object Remover"
      description="Upload a photo, paint over anything you want gone, and a local AI model fills it in — fully on-device."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge>LaMa</Badge>
          <Badge>ONNX Runtime Web</Badge>
          <Badge>WebGPU</Badge>
          <Badge>100% on-device</Badge>
          <Badge>Apache-2.0 model</Badge>
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
          <Editor original={source} remover={remover} onReset={handleReset} />
        )}
      </div>
    </FeaturePanel>
  )
}

export default ObjectRemover
