import { useCallback, useRef, useState } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { ACCEPTED_IMAGE_TYPES } from '../image'

interface DropzoneProps {
  /** Called with the first accepted file from a drop or picker selection. */
  onFile: (file: File) => void
  disabled?: boolean
}

/**
 * Image input: a drag-and-drop surface that doubles as a click target for the
 * hidden file picker. Accepts PNG / JPEG / WebP only.
 */
export function Dropzone({ onFile, disabled = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      onFile(files[0])
    },
    [onFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      if (disabled) return
      handleFiles(e.dataTransfer.files)
    },
    [disabled, handleFiles],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={cn(
        'relative flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center transition-colors',
        dragActive
          ? 'border-indigo-400/70 bg-indigo-500/10'
          : 'border-white/15 bg-white/[0.015] hover:border-white/25',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-indigo-300">
        <ImageIcon className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-200">Drag &amp; drop an image here</p>
        <p className="text-xs text-gray-500">PNG, JPEG, or WebP — processed on your device</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="mt-1 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-100 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Upload className="size-4" aria-hidden="true" />
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
