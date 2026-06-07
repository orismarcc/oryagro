/**
 * useFarmMembers.js — CRUD helpers for farm membership management.
 *
 * All functions operate via Supabase RLS; the DB enforces admin-only mutations.
 */
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

/**
 * Load all members of a farm with their profile info.
 * @param {string} farmId
 * @returns {Promise<Array>}
 */
export async function loadFarmMembers(farmId) {
  // NÃO usar embed profiles(...) — não existe FK direto farm_members→profiles
  // (ambos referenciam auth.users). O embed causava PGRST200 e o toast de erro.
  // Buscamos os membros e os perfis em duas queries e fazemos o merge.
  const { data: members, error } = await supabase
    .from('farm_members')
    .select('id, user_id, role, invited_by, created_at')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: true });
  if (error) { logDbError('loadFarmMembers', error); return []; }
  if (!members || members.length === 0) return [];

  // Busca os perfis dos membros (best-effort — se falhar, usa fallback)
  const userIds = [...new Set(members.map(m => m.user_id).filter(Boolean))];
  let profileMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);
    if (profiles) {
      profileMap = profiles.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    }
  }

  return members.map(m => {
    const p = profileMap[m.user_id] || {};
    return {
      id:          m.id,
      user_id:     m.user_id,
      role:        m.role,
      invited_by:  m.invited_by,
      created_at:  m.created_at,
      email:       p.email ?? '',
      displayName: p.display_name ?? p.email?.split('@')[0] ?? '',
    };
  });
}

/**
 * Look up a user by email and add them to a farm.
 * @param {string} farmId
 * @param {string} email
 * @param {'admin'|'technician'} role
 * @param {string} invitedBy  UUID of the current user
 * @returns {Promise<{success: boolean, error?: string, member?: object}>}
 */
export async function addFarmMember(farmId, email, role, invitedBy) {
  // Look up user by email via RPC (queries profiles table)
  const { data: users, error: lookupErr } = await supabase
    .rpc('lookup_user_by_email', { p_email: email.trim().toLowerCase() });

  if (lookupErr) {
    logDbError('lookup_user_by_email', lookupErr);
    return { success: false, error: 'Erro ao buscar usuário. Tente novamente.' };
  }
  if (!users || users.length === 0) {
    return {
      success: false,
      error:   'Nenhum usuário cadastrado com este e-mail. O usuário deve criar uma conta antes de ser adicionado.',
    };
  }

  const targetUser = users[0];

  // Check if already a member
  const { data: existing } = await supabase
    .from('farm_members')
    .select('id')
    .eq('farm_id', farmId)
    .eq('user_id', targetUser.id)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Este usuário já faz parte desta propriedade.' };
  }

  // Insert
  const { data: member, error: insertErr } = await supabase
    .from('farm_members')
    .insert({ farm_id: farmId, user_id: targetUser.id, role, invited_by: invitedBy })
    .select('id, user_id, role, created_at')
    .single();

  if (insertErr) {
    logDbError('addFarmMember', insertErr);
    return { success: false, error: 'Erro ao adicionar usuário. Verifique suas permissões.' };
  }

  return {
    success: true,
    member: {
      ...member,
      email:       targetUser.email,
      displayName: targetUser.display_name ?? targetUser.email?.split('@')[0] ?? '',
    },
  };
}

/**
 * Remove a member from a farm by their farm_members.id.
 * @param {string} memberId
 * @returns {Promise<boolean>}
 */
export async function removeFarmMember(memberId) {
  const { error } = await supabase.from('farm_members').delete().eq('id', memberId);
  if (error) { logDbError('removeFarmMember', error); return false; }
  return true;
}

/**
 * Change a member's role.
 * @param {string} memberId
 * @param {'admin'|'technician'} newRole
 * @returns {Promise<boolean>}
 */
export async function updateFarmMemberRole(memberId, newRole) {
  const { error } = await supabase
    .from('farm_members')
    .update({ role: newRole })
    .eq('id', memberId);
  if (error) { logDbError('updateFarmMemberRole', error); return false; }
  return true;
}

/**
 * Load all farms a user is a member of (for multi-farm support).
 * @returns {Promise<Array<{farm_id, role, farm}>>}
 */
export async function loadUserMemberships(userId) {
  const { data, error } = await supabase
    .from('farm_members')
    .select('farm_id, role, propriedades(*)')
    .eq('user_id', userId);
  if (error) { logDbError('loadUserMemberships', error); return []; }
  return (data || []).map(m => ({
    farm_id: m.farm_id,
    role:    m.role,
    farm:    m.propriedades,
  }));
}
