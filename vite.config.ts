import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The repo is served from https://sylwia-lask.github.io/practical-browser-ai/
// so every asset URL must be prefixed with the repo name on GitHub Pages.
// Locally (dev / preview) we keep "/" so nothing changes during development.
const base = process.env.GITHUB_PAGES ? '/practical-browser-ai/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // Offline support. The app shell (JS/CSS/HTML/WASM) is precached so the UI
    // loads with no network, and the one-time model downloads from Hugging Face
    // are runtime-cached (CacheFirst) so once a feature's model has been
    // fetched, that feature keeps working fully offline.
    VitePWA({
      registerType: 'autoUpdate',
      // Precache the SPA deep-link fallback too.
      includeAssets: ['vite.svg', '404.html'],
      workbox: {
        // Model weights and the ONNX Runtime WASM binaries are large; raise the
        // precache size limit so the app-shell WASM files are not skipped.
        maximumFileSizeToCacheInBytes: 600 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,ico,png,wasm}'],
        // Explicit fallback so the SW resolves index.html correctly under the
        // GitHub Pages subpath base, giving working offline deep links.
        navigateFallback: `${base}index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${base.replace(/\//g, '\\/')}`)],
        runtimeCaching: [
          {
            // Hugging Face Hub: model config, tokenizer, and ONNX weight files.
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hf-models',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
              },
              // statuses: [0, 200] also caches opaque (CORS) responses.
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            // Hugging Face LFS / CDN that actual weight blobs redirect to.
            urlPattern: /^https:\/\/cdn-lfs.*\.(huggingface\.co|hf\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hf-lfs',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
      manifest: {
        name: 'Practical Browser AI',
        short_name: 'Browser AI',
        description: '5 practical AI features. No backend. No cloud. Just your browser.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
