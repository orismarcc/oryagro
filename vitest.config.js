import { defineConfig } from 'vitest/config';

// Config dedicada de testes (não carrega o plugin PWA do build).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    // Carrega .env.local (VITE_SUPABASE_*) para módulos que importam o client
    // do Supabase no topo — mesmo que os testes não façam rede.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
