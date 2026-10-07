import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/logger', () => ({ logDbError: () => {} }));
vi.mock('../lib/outbox', () => ({ insertOfflineSafe: vi.fn() }));

const { paraKg } = await import('./useProducaoRegistros');

describe('paraKg — colheitas somadas em kg na Agenda e na Análise', () => {
  it('kg, g e t', () => {
    expect(paraKg(120, 'kg')).toBe(120);
    expect(paraKg('500', 'g')).toBe(0.5);
    expect(paraKg(1.2, 't')).toBe(1200);
    expect(paraKg(2, 'ton')).toBe(2000);
  });
  it('sem unidade assume kg', () => {
    expect(paraKg(10, null)).toBe(10);
  });
  it('caixa/unidade não vira kg (não inventa peso)', () => {
    expect(paraKg(30, 'cx')).toBeNull();
    expect(paraKg(30, 'un')).toBeNull();
    expect(paraKg('abc', 'kg')).toBeNull();
  });
});
