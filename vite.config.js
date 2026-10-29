import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Identificador de esta compilación. La app lo compara con /version.json para
// detectar que hay una versión nueva publicada y actualizarse sola.
const BUILD_ID = new Date().toISOString()

// Ícono de la app según la temporada (se decide al compilar). La fecha límite es la
// misma de src/lib/season.js; después de esa fecha hay que volver a publicar para
// que regrese el ícono normal.
const HALLOWEEN_END = readFileSync(new URL('./src/lib/season.js', import.meta.url), 'utf8').match(/HALLOWEEN_END = "([\d-]+)"/)[1]
const HOY_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const T = HOY_MX <= HALLOWEEN_END ? '-halloween' : ''
const ICON = { i192: `icon${T}-192.png`, i512: `icon${T}-512.png`, mask: `icon${T}-maskable-512.png`, apple: `apple-touch-icon${T}.png` }

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
      },
    },
    {
      name: 'iconos-de-temporada',
      transformIndexHtml(html) {
        return html.replaceAll('%ICON_APPLE%', '/' + ICON.apple).replaceAll('%ICON_192%', '/' + ICON.i192).replaceAll('%ICON_512%', '/' + ICON.i512)
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [ICON.apple, ICON.i192, ICON.i512, ICON.mask],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Solo GET a PostgREST/Storage — nunca /auth/ (login, refresh de token)
            // ni /functions/ (Edge Functions), que son POST y no deben cachearse ni
            // pasar por una estrategia de cache que puede colgar la petición.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') &&
              !url.pathname.startsWith('/auth/') &&
              !url.pathname.startsWith('/functions/'),
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              // Guarda una semana de consultas para poder abrir los grupos sin internet
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 6,
            },
          },
        ],
      },
      manifest: {
        name: 'AppProf',
        short_name: 'AppProf',
        description: 'Sistema de Control Docente — asistencia, tareas y calificaciones',
        theme_color: '#07201a',
        background_color: '#07201a',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'es',
        categories: ['education', 'productivity'],
        icons: [
          { src: ICON.i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: ICON.i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: ICON.mask, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: ICON.i512,
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'AppProf — Pantalla principal',
          },
        ],
      },
    }),
  ],
})