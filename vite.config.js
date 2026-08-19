import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
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
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 8,
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
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: 'pwa-512x512.png',
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