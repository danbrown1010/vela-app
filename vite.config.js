import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync } from 'fs'
import { resolve } from 'path'

const BG_DIR = resolve(import.meta.dirname, 'public/chomp_images/backgrounds')
let backgroundUrls = []
try {
  backgroundUrls = readdirSync(BG_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => `/chomp_images/backgrounds/${f}`)
} catch {
  // directory absent at build time — graceful fallback
}

export default defineConfig({
  define: {
    __BACKGROUND_URLS__: JSON.stringify(backgroundUrls),
  },
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'VELA',
        short_name: 'VELA',
        description: 'Engineered for Independence. Your expedition companion for overlanding and off-grid adventure.',
        theme_color: '#1C2117',
        background_color: '#1C2117',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/@supabase/') || id.includes('/node_modules/crypto-js/')) {
            return 'vendor-supabase'
          }
        },
      },
    },
  },
})
