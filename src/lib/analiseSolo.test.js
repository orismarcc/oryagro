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

// ── Plano genérico específico por perfil da cultura ──────────────────────────
// A recomendação sem programa de marca ainda precisa fazer sentido para o TIPO
// da cultura: folhosa puxa N, raiz/fruteira puxam K, fruteira pede boro.
import { CULTURAS } from '../data/culturas';

// Solo pobre e ácido, K baixo — força o plano a reagir.
const SOLO_POBRE = { ph: 5.4, mo: 2.2, p: 9, k: 45, ca: 2.0, mg: 0.7, ctc: 6.8, v: 48, al: 0.4, zn: 0.9, prnt: 85 };

/** Extrai os kg de N e KCl de uma etapa de cobertura ('123 kg X/ha + 45 kg KCl/ha'). */
function doses(etapa) {
  const n = parseFloat((etapa.dose.match(/([\d.,]+)\s*kg\s*(?:Ureia|SA)/) || [])[1]?.replace(',', '.') || '0');
  const k = parseFloat((etapa.dose.match(/([\d.,]+)\s*kg\s*KCl/) || [])[1]?.replace(',', '.') || '0');
  return { n, k };
}
const cobs = (id) => montarPlanoAdubacao({ analise: SOLO_POBRE, cultura: CULTURAS[id], lote: { area_ha: 1 } })
  .etapas.filter(e => e.fase === 'Cobertura');

describe('plano genérico — específico por perfil', () => {
  it('folhosa (alface): nitrogênio domina o potássio e não há boro', () => {
    const c = cobs('alface');
    expect(c.length).toBeGreaterThan(0);
    const { n, k } = doses(c[0]);
    expect(n).toBeGreaterThan(k);                       // N >> K
    expect(c.some(e => /boro/i.test(e.dose))).toBe(false);
  });

  it('folhosa: última cobertura alerta sobre nitrato perto da colheita', () => {
    const c = cobs('couve');
    expect(c[c.length - 1].descricao).toMatch(/nitrato/i);
  });

  it('raiz (mandioca): potássio cresce e supera o N no engrossamento', () => {
    const c = cobs('mandioca');
    const ini = doses(c[0]);
    const fim = doses(c[c.length - 1]);
    expect(fim.k).toBeGreaterThan(ini.k);              // K back-loaded
    expect(fim.k).toBeGreaterThan(fim.n);              // K domina no fim
  });

  it('fruteira (banana): K cresce até a frutificação e entra boro foliar', () => {
    const c = cobs('banana_ana');
    const ini = doses(c[0]);
    const fim = doses(c[c.length - 1]);
    expect(fim.k).toBeGreaterThan(ini.k);
    expect(c.some(e => /boro/i.test(e.dose))).toBe(true);
    expect(c.some(e => /frutifica/i.test(e.etapa))).toBe(true);
  });

  it('fruto anual (quiabo): N cai e K sobe ao longo do ciclo', () => {
    const c = cobs('quiabo');
    const ini = doses(c[0]);
    const fim = doses(c[c.length - 1]);
    expect(fim.n).toBeLessThanOrEqual(ini.n);          // N front-loaded
    expect(fim.k).toBeGreaterThan(ini.k);              // K back-loaded
  });

  it('solo ácido: troca ureia por Sulfato de Amônio a partir da 2ª cobertura', () => {
    const c = cobs('quiabo');
    expect(c[0].produto).toMatch(/Ureia/);
    expect(c[1].produto).toMatch(/Sulfato de Am|SA/);
  });
});
