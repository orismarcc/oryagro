/**
 * permissions.js — Centralized RBAC permission checker.
 *
 * ALL role checks in the codebase must go through `can()`.
 * Adding a new permission requires only editing this file.
 */

/** All possible farm actions. Use these constants everywhere — no inline strings. */
export const FARM_ACTIONS = {
  // Readable by everyone
  VIEW_FARM:          'VIEW_FARM',
  VIEW_LOTS:          'VIEW_LOTS',
  // Technician can also do
  CREATE_LOT:         'CREATE_LOT',
  EDIT_LOT:           'EDIT_LOT',
  MARK_TASK_DONE:     'MARK_TASK_DONE',
  CREATE_EVENT:       'CREATE_EVENT',
  // Estoque (I-09): technician can view but not edit/delete
  VIEW_ESTOQUE:       'VIEW_ESTOQUE',
  EDIT_ESTOQUE:       'EDIT_ESTOQUE',
  // Admin-only
  VIEW_ANALYSIS:      'VIEW_ANALYSIS',
  DELETE_ANY:         'DELETE_ANY',
  MANAGE_MEMBERS:     'MANAGE_MEMBERS',
  EDIT_FARM:          'EDIT_FARM',          // edit property name/description (I-10)
  EDIT_FARM_SETTINGS: 'EDIT_FARM_SETTINGS',
  EXPORT_PDF:         'EXPORT_PDF',
};

/** Role → allowed actions map */
const PERMISSIONS = {
  admin: new Set(Object.values(FARM_ACTIONS)),
  technician: new Set([
    FARM_ACTIONS.VIEW_FARM,
    FARM_ACTIONS.VIEW_LOTS,
    FARM_ACTIONS.CREATE_LOT,
    FARM_ACTIONS.EDIT_LOT,
    FARM_ACTIONS.MARK_TASK_DONE,
    FARM_ACTIONS.CREATE_EVENT,
    FARM_ACTIONS.VIEW_ESTOQUE,   // technician can view stock
  ]),
};

/**
 * Returns true if the given role is allowed to perform action.
 * @param {string|null} role  'admin' | 'technician' | null
 * @param {string}      action  one of FARM_ACTIONS
 * @returns {boolean}
 */
export function can(role, action) {
  if (!role) return false;
  return PERMISSIONS[role]?.has(action) ?? false;
}
