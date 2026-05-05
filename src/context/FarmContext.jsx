/**
 * FarmContext.jsx — Provides the active farm and the current user's role in it.
 *
 * Wrap the app with <FarmProvider session={session}> and call useFarm()
 * anywhere to get { userRole, activeFarmId, setActiveFarmId, ... }.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { loadUserMemberships } from '../hooks/useFarmMembers';

const FarmContext = createContext(null);

export function FarmProvider({ children, session }) {
  /** All farms the user belongs to: [{farm_id, role, farm}] */
  const [memberships, setMemberships] = useState([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);

  const refreshMemberships = useCallback(async () => {
    if (!session) {
      setMemberships([]);
      setLoadingMemberships(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingMemberships(false); return; }
    const ms = await loadUserMemberships(user.id);
    setMemberships(ms);
    setLoadingMemberships(false);
  }, [session]);

  useEffect(() => {
    setLoadingMemberships(true);
    refreshMemberships();
  }, [refreshMemberships]);

  /**
   * Get the current user's role in a specific farm.
   * Returns 'admin' | 'technician' | null
   */
  const getUserRole = useCallback((farmId) => {
    if (!farmId) return null;
    const m = memberships.find(m => String(m.farm_id) === String(farmId));
    return m?.role ?? null;
  }, [memberships]);

  /**
   * True if the user is admin in at least one farm (owns at least one property).
   * Pure technicians (member in others' farms only) get false.
   */
  const isGlobalAdmin = memberships.some(m => m.role === 'admin');

  return (
    <FarmContext.Provider value={{
      memberships,
      loadingMemberships,
      getUserRole,
      refreshMemberships,
      isGlobalAdmin,
    }}>
      {children}
    </FarmContext.Provider>
  );
}

/** Hook to consume FarmContext */
export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used inside <FarmProvider>');
  return ctx;
}
