import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// ── Security headers ──────────────────────────────────────────────────────────
// Aplicados tanto no servidor de dev quanto injetados via vercel.json em prod.
const securityHeaders = [
  // Impede carregamento em iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Bloqueia sniffing de MIME type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Força HTTPS por 1 ano (apenas em prod)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Controla informações de referrer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Desabilita funcionalidades desnecessárias do browser
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  // Content Security Policy
  // - default-src 'self': bloqueia tudo por padrão
  // - connect-src: permite chamadas ao Supabase e OpenWeather API
  // - style-src 'unsafe-inline' + fonts.googleapis: Tailwind + Google Fonts CSS
  // - font-src + fonts.gstatic: arquivos de fonte do Google
  // - worker-src + manifest-src: necessários para PWA (service worker + manifest)
  // - img-src data: blob:: para imagens geradas localmente (gráficos, PDF) e ícones
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://geocoding-api.open-meteo.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' https://fonts.gstatic.com data:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ── PWA: instalável no celular, manifest + service worker auto-update ────
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // O manifest físico (public/manifest.webmanifest) já existe e é referenciado
      // pelo index.html. Aqui pedimos ao plugin para NÃO sobrescrever esse arquivo;
      // ele apenas gera o service worker.
      manifest: false,
      includeAssets: [
        'favicon.svg',
        'manifest.webmanifest',
        'icons/*.png',
      ],
      workbox: {
        // Permite navegação SPA estando offline (fallback para index.html)
        navigateFallback: '/index.html',
        // Ignora rotas internas do Supabase / API externas — não devem ser cacheadas
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /\.[a-z0-9]+$/i],
        // Cache de runtime para APIs externas (Open-Meteo)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://api.open-meteo.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1h
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://geocoding-api.open-meteo.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'geocoding-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7d
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1y
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Limite de tamanho de arquivo para pré-cache (default 2 MB).
        // O bundle gerado é ~2 MB minificado — elevamos para 4 MB para incluí-lo.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        // Habilita o SW também em `vite dev` para teste local
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: Object.fromEntries(securityHeaders.map(h => [h.key, h.value])),
  },
})
