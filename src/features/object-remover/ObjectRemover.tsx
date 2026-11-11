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

  // The current source URL, kept in a ref (updated as soon as a source is
  // swapped in) so a later upload or unmount can revoke it.
  const sourceUrlRef = useRef<string | null>(null)

  // Upload guard: every upload (file or sample) takes a new id, and only the
  // latest one may set the source. Picking two images quickly can otherwise let
  // the first, slower decode finish last and overwrite the newer selection.
  // Reset and unmount bump the id too, so anything still in flight is dropped.
  const uploadIdRef = useRef(0)

  useEffect(() => {
    return () => {
      uploadIdRef.current++
      releaseImage(sourceUrlRef.current)
      sourceUrlRef.current = null
    }
  }, [])

  /** Decode `file` for upload `id`; a stale result is revoked, not shown. */
  const loadFile = useCallback(
    async (file: File, id: number) => {
      try {
        const prepared = await prepareImage(file)
        if (id !== uploadIdRef.current) {
          releaseImage(prepared.url)
          return
        }
        // Swap in the new source, revoking the previous preview URL.
        releaseImage(sourceUrlRef.current)
        sourceUrlRef.current = prepared.url
        setSource({
          url: prepared.url,
          width: prepared.width,
          height: prepared.height,
          name: file.name,
        })
      } catch (err) {
        if (id !== uploadIdRef.current) return
        setImageError(err instanceof Error ? err.message : 'Could not load that image.')
      }
    },
    [],
  )

  const handleFile = useCallback(
    (file: File) => {
      const id = ++uploadIdRef.current
      setImageError(null)
      resetEdits()
      void loadFile(file, id)
    },
    [loadFile, resetEdits],
  )

  const handleSample = useCallback(async () => {
    // Take the id before fetching, so a file picked while the sample is still
    // loading wins over it.
    const id = ++uploadIdRef.current
    setImageError(null)
    resetEdits()
    try {
      const file = await loadSampleFile()
      if (id !== uploadIdRef.current) return
      await loadFile(file, id)
    } catch (err) {
      if (id !== uploadIdRef.current) return
      setImageError(err instanceof Error ? err.message : 'Could not load the sample photo.')
    }
  }, [loadFile, resetEdits])

  const handleReset = useCallback(() => {
    uploadIdRef.current++
    releaseImage(sourceUrlRef.current)
    sourceUrlRef.current = null
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
