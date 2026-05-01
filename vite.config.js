import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Content Security Policy
  // - default-src 'self': bloqueia tudo por padrão
  // - connect-src: permite chamadas ao Supabase e OpenWeather API
  // - style-src 'unsafe-inline': necessário para Tailwind em dev
  // - img-src data: blob:: para imagens geradas localmente (gráficos, PDF)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",          // React + Vite injetam inline em dev
      "style-src 'self' 'unsafe-inline'",            // Tailwind requer unsafe-inline
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://geocoding-api.open-meteo.com",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "frame-ancestors 'none'",                       // reforça X-Frame-Options
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
