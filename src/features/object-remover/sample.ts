/**
 * Bundled sample photo for the Object Remover.
 *
 * Same approach as the Background Remover's sample: the image lives next to
 * this module and is imported as a URL so Vite rewrites the path for the
 * GitHub Pages base and fingerprints the filename. As a hashed `.jpg` in the
 * build output it is precached by the PWA service worker (see `globPatterns`
 * in `vite.config.ts`), so "Upload sample photo" also works fully offline.
 *
 * Photo: "Group of friends admiring a mountain lake view" by Ben Kupke
 * (https://unsplash.com/photos/8cv59Ix2psA), free to use under the Unsplash
 * License (https://unsplash.com/license). Resized to 1600×1067 JPEG (~330 KB).
 * Separate people against water, forest, and stones make it a fair demo of
 * what the model fills well.
 */
import sampleUrl from './sample.jpg'

/** Source filename for the sample; the download becomes "sample-lake-edited.png". */
export const SAMPLE_FILENAME = 'sample-lake.jpg'

/**
 * Load the bundled sample photo as a `File`, ready to hand to the same code
 * path as a user upload. Throws if the asset can't be fetched.
 */
export async function loadSampleFile(): Promise<File> {
  const res = await fetch(sampleUrl)
  if (!res.ok) {
    throw new Error('Could not load the sample photo.')
  }
  const blob = await res.blob()
  return new File([blob], SAMPLE_FILENAME, {
    type: blob.type || 'image/jpeg',
  })
}
