import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'

/** Imperative API the parent uses to read/clear the painted mask. */
export interface MaskPainterHandle {
  /**
   * Build the model mask at full image resolution: 255 = keep, 0 = fill.
   * Returns null when nothing has been painted.
   */
  getMask: () => Uint8Array | null
  clear: () => void
}

interface MaskPainterProps {
  /** Image currently being edited (original or latest edit). */
  imageUrl: string
  /** Natural size of that image — the mask is built at exactly this size. */
  width: number
  height: number
  /** Brush diameter in on-screen CSS pixels (converted to image pixels). */
  brushSize: number
  disabled?: boolean
  /** Called whenever the painted area goes from empty to non-empty or back. */
  onPaintedChange?: (painted: boolean) => void
  ref?: Ref<MaskPainterHandle>
}

/**
 * Brush-to-select surface for object removal.
 *
 * The image is shown with a transparent canvas of the *same pixel size as the
 * image* laid over it. Strokes are drawn opaque and the canvas is shown at 50%
 * opacity, so overlapping strokes don't build up darker patches and the mask is
 * simply "every pixel with alpha > 0". Pointer coordinates are mapped from CSS
 * pixels to image pixels, so the brush lines up at any zoom or screen size.
 *
 * No model is involved in selecting — this costs nothing until the user runs
 * the removal.
 */
export function MaskPainter({
  imageUrl,
  width,
  height,
  brushSize,
  disabled = false,
  onPaintedChange,
  ref,
}: MaskPainterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const painted = useRef(false)

  const setPainted = useCallback(
    (value: boolean) => {
      if (painted.current === value) return
      painted.current = value
      onPaintedChange?.(value)
    },
    [onPaintedChange],
  )

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    lastPoint.current = null
    setPainted(false)
  }, [setPainted])

  // A new image (e.g. after an edit or undo) starts with a clean selection.
  useEffect(() => {
    clear()
  }, [imageUrl, clear])

  useImperativeHandle(
    ref,
    () => ({
      clear,
      getMask: () => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d', { willReadFrequently: true })
        if (!canvas || !ctx || !painted.current) return null
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const mask = new Uint8Array(canvas.width * canvas.height)
        let any = false
        for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
          if (rgba[p] > 0) {
            mask[i] = 0 // fill
            any = true
          } else {
            mask[i] = 255 // keep
          }
        }
        return any ? mask : null
      },
    }),
    [clear],
  )

  /** CSS-pixel pointer position -> image-pixel position, plus the scale. */
  const toImage = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * (canvas.height / rect.height),
      scale,
    }
  }, [])

  const drawTo = useCallback(
    (clientX: number, clientY: number) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const { x, y, scale } = toImage(clientX, clientY)
      const from = lastPoint.current ?? { x, y }
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = brushSize * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      lastPoint.current = { x, y }
      setPainted(true)
    },
    [brushSize, toImage, setPainted],
  )

  const moveCursor = useCallback(
    (clientX: number, clientY: number, visible: boolean) => {
      const cursor = cursorRef.current
      const canvas = canvasRef.current
      if (!cursor || !canvas) return
      const rect = canvas.getBoundingClientRect()
      cursor.style.display = visible ? 'block' : 'none'
      cursor.style.width = `${brushSize}px`
      cursor.style.height = `${brushSize}px`
      cursor.style.transform = `translate(${clientX - rect.left - brushSize / 2}px, ${
        clientY - rect.top - brushSize / 2
      }px)`
    },
    [brushSize],
  )

  return (
    <div
      className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-white/10 bg-black/30"
      style={{ aspectRatio: String(width / height) }}
    >
      <img
        src={imageUrl}
        alt="Image being edited"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-label="Paint over the objects you want to remove"
        role="img"
        className={
          disabled
            ? 'pointer-events-none absolute inset-0 size-full opacity-50'
            : 'absolute inset-0 size-full cursor-none opacity-50'
        }
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          lastPoint.current = null
          drawTo(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          moveCursor(e.clientX, e.clientY, !disabled)
          if (disabled || e.buttons !== 1) return
          drawTo(e.clientX, e.clientY)
        }}
        onPointerUp={() => {
          lastPoint.current = null
        }}
        onPointerLeave={(e) => moveCursor(e.clientX, e.clientY, false)}
      />
      {/* Brush outline that follows the pointer (updated via ref, no re-render). */}
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 hidden rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      />
    </div>
  )
}
