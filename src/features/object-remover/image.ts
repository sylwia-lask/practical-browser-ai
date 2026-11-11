/**
 * Image loading / preprocessing utilities for the Object Remover.
 *
 * Responsibilities:
 *  - Validate that an uploaded file is a supported image type (PNG/JPEG/WebP).
 *  - Decode the file **with EXIF orientation applied** (so a phone photo isn't
 *    exported sideways), using `createImageBitmap`'s `imageOrientation` option.
 *  - Optionally downscale very large uploads before anything else, to cap peak
 *    memory on high-resolution photos. The longest edge is bounded; aspect
 *    ratio is always preserved.
 *  - Produce (a) an object URL for previewing / handing to the worker and
 *    (b) the decoded, orientation-corrected dimensions used for compositing.
 *
 * The decoded pixels are rasterized to a PNG blob once here so the worker and
 * the final compositing step agree on the exact same orientation-corrected
 * image — the model never sees raw EXIF rotation.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

/**
 * Longest edge (px) we downscale uploads to before processing. LaMa fills at
 * 512×512 regardless (the worker crops around the selection), so there's no
 * quality gain from editing an enormous original — but there is a real memory cost
 * (a 6000×4000 photo is ~96 MB as RGBA). 2048 keeps exports crisp while
 * bounding memory. Images at or below this are kept at native resolution.
 */
const MAX_EDGE = 2048

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
}

export interface PreparedImage {
  /** Object URL for the orientation-corrected image — revoke when done. */
  url: string
  /** Orientation-corrected width (what the exported PNG will be). */
  width: number
  /** Orientation-corrected height. */
  height: number
}

/**
 * Decode a bitmap from a file with EXIF orientation applied. Falls back to the
 * default decode if the browser doesn't support `imageOrientation`.
 */
async function decodeOriented(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older browsers: decode without explicit orientation handling.
    return createImageBitmap(file)
  }
}

/**
 * Validate, orientation-correct, and (if needed) downscale an image file,
 * returning an object URL plus the final dimensions.
 *
 * Throws an Error with a user-facing message on unsupported or unreadable input.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedImage(file)) {
    throw new Error('Unsupported file type. Please use PNG, JPEG, or WebP.')
  }

  const bitmap = await decodeOriented(file).catch(() => {
    throw new Error('Could not read this image. The file may be corrupted.')
  })

  try {
    const { width, height } = bitmap
    if (width === 0 || height === 0) {
      throw new Error('This image appears to be empty.')
    }

    const longest = Math.max(width, height)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    // Always re-rasterize to a canvas so EXIF orientation is baked into the
    // pixels and the worker + compositor share one canonical image. (Reading
    // the original File directly would hand the model un-rotated pixels.)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // Canvas unavailable — fall back to the original file bytes.
      return { url: URL.createObjectURL(file), width, height }
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) {
      return { url: URL.createObjectURL(file), width: targetW, height: targetH }
    }
    return { url: URL.createObjectURL(blob), width: targetW, height: targetH }
  } finally {
    bitmap.close()
  }
}

/** Revoke an object URL created by {@link prepareImage}. Safe to call with "". */
export function releaseImage(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
