import { describe, it, expect } from 'vitest';
import { can, FARM_ACTIONS } from './permissions';

describe('permissions.can', () => {
  it('admin pode tudo', () => {
    for (const action of Object.values(FARM_ACTIONS)) {
      expect(can('admin', action)).toBe(true);
    }
  });

  it('technician pode operar lote mas NÃO ações de admin', () => {
    expect(can('technician', FARM_ACTIONS.CREATE_LOT)).toBe(true);
    expect(can('technician', FARM_ACTIONS.MARK_TASK_DONE)).toBe(true);
    expect(can('technician', FARM_ACTIONS.VIEW_ESTOQUE)).toBe(true);
    // Admin-only
    expect(can('technician', FARM_ACTIONS.VIEW_ANALYSIS)).toBe(false);
    expect(can('technician', FARM_ACTIONS.DELETE_ANY)).toBe(false);
    expect(can('technician', FARM_ACTIONS.MANAGE_MEMBERS)).toBe(false);
    expect(can('technician', FARM_ACTIONS.EDIT_ESTOQUE)).toBe(false);
  });

  it('sem role / role inválido nega tudo', () => {
    expect(can(null, FARM_ACTIONS.VIEW_FARM)).toBe(false);
    expect(can(undefined, FARM_ACTIONS.VIEW_FARM)).toBe(false);
    expect(can('intruso', FARM_ACTIONS.VIEW_FARM)).toBe(false);
  });
});
