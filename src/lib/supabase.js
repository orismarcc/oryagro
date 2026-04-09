import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjwwbynuqnfqkjdoexhm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlqd3dieW51cW5mcWtqZG9leGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTcyMTMsImV4cCI6MjA5MDg5MzIxM30.rBlbwJXN7nDbyheQtNdJB-juJ-UdnSGC4kcpYYP6fQE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Garante que links de email apontem para a URL de produção
    flowType: 'pkce',
  },
});
