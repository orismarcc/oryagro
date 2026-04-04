import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjwwbynuqnfqkjdoexhm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlqd3dieW51cW5mcWtqZG9leGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNzIxMywiZXhwIjoyMDkwODkzMjEzfQ.rBlbwJXN7nDbyheQtNdJB-juJ-UdnSGC4kcpYYP6fQE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
