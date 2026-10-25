/**
 * Service worker registration for offline support.
 *
 * `vite-plugin-pwa` generates the service worker at build time and exposes a
 * tiny helper through the `virtual:pwa-register` module. Registering it makes
 * the app installable and lets it run offline: the app shell (JS/CSS/HTML/WASM)
 * is precached, and each feature's one-time Hugging Face model download is
 * runtime-cached (CacheFirst), so once a model has been fetched that feature
 * keeps working with no network.
 *
 * `registerType: 'autoUpdate'` (see vite.config.ts) means a new deployment is
 * fetched and activated automatically — no update prompt to wire up here.
 *
 * In dev the virtual module is a no-op unless PWA dev options are enabled, so
 * this is safe to call unconditionally.
 */
import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker(): void {
  // `immediate` activates the SW as soon as it is ready rather than waiting for
  // the next navigation, so the first visit starts caching right away.
  registerSW({ immediate: true })
}
