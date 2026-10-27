/**
 * Bundled sample photo for the Background Remover.
 *
 * The image lives next to this module and is imported as a URL so Vite:
 *  - rewrites the path with the correct base (works under the GitHub Pages
 *    `/practical-browser-ai/` subpath), and
 *  - fingerprints the filename for cache-busting.
 *
 * Because it is a hashed `.png` emitted into the build output, the PWA service
 * worker precaches it (see `globPatterns` in `vite.config.ts`), so "Upload
 * sample photo" also works fully offline.
 *
 * To fetch it as a `File` (what the Dropzone pipeline expects), we request the
 * asset and wrap the blob — this is a same-origin request to our own bundled
 * asset, so there is no CORS or network dependency beyond the cached file.
 */
import sampleUrl from './sample.png'

/** Human-friendly filename used for the downloaded cut-out. */
export const SAMPLE_FILENAME = 'sample-sneaker.png'

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
    type: blob.type || 'image/png',
  })
}
