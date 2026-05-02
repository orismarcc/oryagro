import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(() => {
      setSession(null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const rawUser = session?.user ?? null;

  // Resolve display name: user_metadata.display_name → fallback to email prefix
  const displayName = rawUser
    ? (rawUser.user_metadata?.display_name?.trim() || rawUser.email?.split('@')[0] || '')
    : '';

  return {
    session,
    loading,
    user: rawUser,
    displayName,
    signOut,
  };
}
