import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // Shown by ?gfx=, to tell which build a machine is actually running.
    __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)),
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks, so a deploy of the app's code doesn't re-download three.js and React.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'three', test: /node_modules[\\/](three[^\\/]*|@react-three)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-64x64.png', 'apple-touch-icon-180x180.png', 'textures/wc-patterned-stone.jpg'],
      manifest: {
        name: 'Nest',
        short_name: 'Nest',
        description: 'Our house: walls, colours and furniture.',
        theme_color: '#0b0f11',
        background_color: '#0b0f11',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The three.js chunk is large; let the service worker cache it.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/auth/],
        // Furniture models and thumbnails load on demand; keep them once seen so the app works offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'nest-models', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
})
