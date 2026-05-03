import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);
  // O-08: display_name from profiles table overrides user_metadata
  const [profileDisplayName, setProfileDisplayName] = useState(null);

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

  // O-08: fetch display_name from profiles table when session changes
  useEffect(() => {
    if (!session?.user?.id) { setProfileDisplayName(null); return; }
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfileDisplayName(data?.display_name?.trim() || null);
      })
      .catch(() => setProfileDisplayName(null));
  }, [session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfileDisplayName(null);
  };

  const rawUser = session?.user ?? null;

  // O-08: Priority: profiles.display_name → user_metadata.display_name → email prefix
  const displayName = rawUser
    ? (
        profileDisplayName ||
        rawUser.user_metadata?.display_name?.trim() ||
        rawUser.email?.split('@')[0] ||
        ''
      )
    : '';

  return {
    session,
    loading,
    user: rawUser,
    displayName,
    signOut,
  };
}
