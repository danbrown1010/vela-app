import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))
const buildDate = new Date().toISOString().split('T')[0]

const BG_DIR = resolve(import.meta.dirname, 'public/chomp_images/backgrounds')
let backgroundUrls = []
try {
  backgroundUrls = readdirSync(BG_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => `/chomp_images/backgrounds/${f}`)
} catch {
  // directory absent at build time — graceful fallback
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __BACKGROUND_URLS__: JSON.stringify(backgroundUrls),
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_DATE__: JSON.stringify(buildDate),
      __ENV_LABEL__: JSON.stringify(env.VITE_ENV_LABEL || ''),
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
  }
})
