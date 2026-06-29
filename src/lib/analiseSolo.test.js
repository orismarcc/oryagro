import { describe, it, expect } from 'vitest';
import {
  derivarIndices, calcularCalagem, montarPlanoAdubacao, interpretarSolo, kParaCmolc,
} from './analiseSolo';

// Dados reais do laudo Solocria VND 10465 (Sítio Portuga)
const ACEROLA = { ph: 4.4, p: 2.3, k: 76.5, ca: 1.1, mg: 0.4, al: 0.5, hAl: 2.7, mo: 16, zn: 1.5, argila: 16, prnt: 80 };
// Abacaxi = média A02+A03 do laudo (H+Al médio 3,1; Al médio 0,45) → CTC ~4,75
const ABACAXI = { ph: 4.55, p: 2.35, k: 78.4, ca: 1.1, mg: 0.35, al: 0.45, hAl: 3.1, mo: 19, zn: 0.95, argila: 17, prnt: 80 };

const culturaAcerola = { id: 'acerola', tipoCultura: 'perene', tipo: 'campo', cronograma: [], insumos: {} };
const culturaAbacaxi = { id: 'abacaxi', tipoCultura: 'anual', tipo: 'campo', cronograma: [], insumos: {} };

describe('analiseSolo — índices derivados', () => {
  it('converte K mg/dm³ para cmolc', () => {
    expect(kParaCmolc(391)).toBeCloseTo(1.0, 3);
  });
  it('CTC e V% da acerola batem com o laudo (CTC ~4,40 · V% ~38,6)', () => {
    const idx = derivarIndices(ACEROLA);
    expect(idx.ctc).toBeCloseTo(4.4, 1);
    expect(idx.v).toBeGreaterThan(37);
    expect(idx.v).toBeLessThan(40);
  });
  it('saturação por Al da acerola > 20% (toxicidade)', () => {
    const idx = derivarIndices(ACEROLA);
    expect(idx.m).toBeGreaterThan(20);
  });
});

describe('analiseSolo — calagem (método V%)', () => {
  it('acerola → ~1,45 t/ha computado, ~1,4–1,5 adotado (V2=65)', () => {
    const idx = derivarIndices(ACEROLA);
    const c = calcularCalagem({ ctc: idx.ctc, v: idx.v, v2: 65, prnt: 80 });
    expect(c.computada).toBeCloseTo(1.45, 1);
    expect(c.adotada).toBeGreaterThanOrEqual(1.4);
    expect(c.adotada).toBeLessThanOrEqual(1.5);
  });
  it('abacaxi → ~1,2 t/ha (V2=55, média A02+A03)', () => {
    const idx = derivarIndices(ABACAXI);
    const c = calcularCalagem({ ctc: idx.ctc, v: idx.v, v2: 55, prnt: 80 });
    expect(c.computada).toBeCloseTo(1.2, 1);
    expect(c.adotada).toBeCloseTo(1.2, 1);
  });
  it('não recomenda calagem quando V% já atinge a meta', () => {
    const c = calcularCalagem({ ctc: 5, v: 70, v2: 65, prnt: 80 });
    expect(c.adotada).toBe(0);
  });
});

describe('analiseSolo — plano de adubação', () => {
  it('acerola: gera calagem (D-60), cova (D-30) e 4 coberturas', () => {
    const plano = montarPlanoAdubacao({ analise: ACEROLA, cultura: culturaAcerola });
    expect(plano.precisaCalagem).toBe(true);
    expect(plano.calagem.adotada).toBeGreaterThanOrEqual(1.4);
    expect(plano.dolomitico).toBe(true); // Mg baixo
    const offsets = plano.etapas.map(e => e.offset);
    expect(offsets).toContain(-60); // calagem
    expect(offsets).toContain(-30); // cova
    expect(plano.coberturas.length).toBe(4);
  });
  it('acerola: usa Sulfato de Amônio a partir da 2ª cobertura (solo ácido)', () => {
    const plano = montarPlanoAdubacao({ analise: ACEROLA, cultura: culturaAcerola });
    expect(plano.coberturas[0].produto).toMatch(/Ureia/);
    expect(plano.coberturas[1].produto).toMatch(/Sulfato de Am/);
  });
  it('abacaxi: fosfatagem de área (P baixo) e sem cova', () => {
    const plano = montarPlanoAdubacao({ analise: ABACAXI, cultura: culturaAbacaxi });
    expect(plano.fosfatagem).toBe(true);
    const temCova = plano.etapas.some(e => /cova/i.test(e.etapa));
    expect(temCova).toBe(false);
  });
  it('diagnóstico aponta acidez, alumínio e fósforo baixo', () => {
    const { diagnostico } = interpretarSolo(ACEROLA, culturaAcerola);
    expect(diagnostico.join(' ')).toMatch(/ácido/i);
    expect(diagnostico.join(' ')).toMatch(/alum/i);
    expect(diagnostico.join(' ')).toMatch(/[Ff]ósforo/);
  });
});
