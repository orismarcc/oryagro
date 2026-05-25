import { createClient } from '@supabase/supabase-js';

// ── Validação de ambiente ─────────────────────────────────────────────────────
// Falha rápido em dev se as variáveis não estiverem configuradas.
// Em produção, variáveis são injetadas pelo Vercel no build.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[OryAgro] Variáveis de ambiente Supabase não configuradas.\n' +
    'Copie .env.example para .env.local e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Garante que links de email apontem para a URL de produção
    flowType: 'pkce',
  },
});

/**
 * Retorna o user_id do usuário autenticado ou null.
 *
 * Usa getSession() (leitura em memória/localStorage) em vez de getUser()
 * (que faz uma requisição de rede para validar o JWT) — evita round-trips
 * desnecessários ao Supabase Auth em cada chamada de função (Arch#7).
 */
export async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
