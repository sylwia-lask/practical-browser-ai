import { useCallback, useId, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'

interface BeforeAfterProps {
  /** Original image URL (shown to the right of the handle). */
  beforeUrl: string
  /** Edited image URL (revealed to the left of the handle). */
  afterUrl: string
  /** Aspect ratio (width / height) so the frame matches the image exactly. */
  aspectRatio: number
}

/**
 * Before/after comparison slider.
 *
 * The original image fills the frame. The edited image is layered on top and
 * clipped to a draggable width, revealing the result as the handle moves.
 * Works with mouse, touch, and keyboard (the handle is a slider role with
 * arrow-key support).
 */
export function BeforeAfter({ beforeUrl, afterUrl, aspectRatio }: BeforeAfterProps) {
  const [position, setPosition] = useState(50) // percent revealed of the "after"
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderId = useId()

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      updateFromClientX(e.clientX)
    },
    [updateFromClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return
      updateFromClientX(e.clientX)
    },
    [updateFromClientX],
  )

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 2))
    else if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 2))
    else if (e.key === 'Home') setPosition(0)
    else if (e.key === 'End') setPosition(100)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-white/10 bg-black/30"
      style={{ aspectRatio: String(aspectRatio) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      {/* Base layer: original image. */}
      <img
        src={beforeUrl}
        alt="Original"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />

      {/* Reveal layer: the edited image, clipped to `position`. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={afterUrl}
          alt="Edited"
          draggable={false}
          className="absolute inset-0 size-full object-contain"
        />
      </div>

      {/* Labels. */}
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-gray-200 backdrop-blur">
        Edited
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-gray-200 backdrop-blur">
        Original
      </span>

      {/* Divider + handle. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: `${position}%` }}
      >
        <div
          role="slider"
          id={sliderId}
          aria-label="Comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className={cn(
            'pointer-events-auto absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/70 bg-white/90 text-gray-900 shadow',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
          )}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none">
            <path
              d="M9 7l-4 5 4 5M15 7l4 5-4 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
