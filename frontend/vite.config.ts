/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // The manifest is fetched without cookies by default, so nginx's bot check would 302 it
      // even after the browser passed the challenge.
      useCredentials: true,
      workbox: {
        // Navigations hit the network first: serving the cached shell would hide nginx's bot-check
        // page, and every /api call would then get its 302. The cache only answers offline.
        navigateFallback: null,
        runtimeCaching: [
          {
            // /api responses are per-user (cookie auth), so never cache them.
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              // Only real pages: never store nginx's redirect to the bot check.
              cacheableResponse: { statuses: [200] },
              precacheFallback: { fallbackURL: 'index.html' },
            },
          },
        ],
      },
      manifest: {
        name: 'shopwith',
        short_name: 'shopwith',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0c1b1c',
        background_color: '#0c1b1c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server:{
    proxy:{'/api':'http://localhost:3000'}
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
