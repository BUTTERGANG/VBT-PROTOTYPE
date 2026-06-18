import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  server: {
    host: '0.0.0.0',      // bind to all interfaces so Replit webview can reach it
    port: 5173,
    allowedHosts: true,   // accept *.replit.dev and *.repl.co hostnames
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // selfDestroying: ships a service worker that UNREGISTERS itself and
      // wipes all precaches on load. This clears any stale bundle a previous
      // SW cached in the browser. Keep this ON while iterating on the vision
      // pipeline so every rebuild is picked up immediately (a normal refresh
      // does NOT bypass a service worker). To restore offline/PWA-install
      // support once the analyzer is stable, set this back to false.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'VBT Tracker',
        short_name: 'VBT',
        description: 'Velocity Based Training Tracker',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'apple-touch-icon.svg',
            sizes: '180x180',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API calls on same-origin (backend serves /api)
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
})
