import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Sizzler is installable and works offline (app shell + cached recipes).
// We use injectManifest so we can author our own service worker (push + sync)
// while still letting Workbox precache the build output.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: null, // we register manually in src/lib/pwa.js
      manifest: {
        name: 'Sizzler',
        short_name: 'Sizzler',
        description: 'Store recipes, plan your meals, shop smarter.',
        theme_color: '#FBF5EC',
        background_color: '#FBF5EC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['food', 'lifestyle', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    // Honour an assigned PORT (e.g. from the preview harness); default 5180.
    port: Number(process.env.PORT) || 5180,
    strictPort: false,
    // Proxy API + uploaded images to the Express server in dev.
    proxy: {
      '/api': { target: 'http://localhost:3011', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3011', changeOrigin: true }
    }
  }
})
