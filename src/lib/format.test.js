import { describe, it, expect } from 'vitest';
import { fmtBRL, fmtNumber, fmtDate, fmtKg } from './format';

describe('format', () => {
  it('fmtBRL formata reais', () => {
    expect(fmtBRL(1234.5)).toMatch(/R\$\s?1\.234,50/);
    expect(fmtBRL(0)).toMatch(/R\$\s?0,00/);
    expect(fmtBRL(null)).toMatch(/R\$\s?0,00/);
  });

  it('fmtNumber usa separador pt-BR', () => {
    expect(fmtNumber(1234)).toBe('1.234');
    expect(fmtNumber(null)).toBe('0');
  });

  it('fmtDate converte ISO → dd/mm/aaaa', () => {
    expect(fmtDate('2026-04-18')).toBe('18/04/2026');
    expect(fmtDate('2026-04-18T12:00:00Z')).toBe('18/04/2026');
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('lixo')).toBe('—');
  });

  it('fmtKg usa toneladas acima de 1000', () => {
    expect(fmtKg(800)).toBe('800 kg');
    expect(fmtKg(1500)).toBe('1.5t');
    expect(fmtKg(0)).toBe('0 kg');
  });
});
