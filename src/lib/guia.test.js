import { describe, it, expect } from 'vitest';
import { somaDias, totalNoLote, categoriaDaEtapa } from './guia';

describe('somaDias', () => {
  it('soma sem perder dia por fuso (virada de mês)', () => {
    expect(somaDias('2026-08-10', 70)).toBe('2026-10-19');   // transplante do maracujá
    expect(somaDias('2026-01-30', 2)).toBe('2026-02-01');
  });
});

describe('totalNoLote — total da dose para o lote', () => {
  const lote = { plantas: 440, areaHa: 0.44 };
  it('por planta: × plantas, com g→kg', () => {
    expect(totalNoLote('30 g/planta de sulfato', lote)).toBe('13,2 kg');
    expect(totalNoLote('30 g/planta de sulfato + 20 g/planta de nitrato', lote)).toBe('13,2 kg + 8,8 kg');
  });
  it('faixas viram faixas (adubação de cova)', () => {
    expect(totalNoLote('100–200 g NPK (por cova)', lote)).toBe('44–88 kg');
    expect(totalNoLote('6–12 L esterco por cova', lote)).toBe('2.640–5.280 L');
    expect(totalNoLote('150 a 300 g/cova', lote)).toBe('66–132 kg');
  });
  it('por hectare: × área do lote', () => {
    expect(totalNoLote('60 kg/ha de ureia', lote)).toBe('26,4 kg');
    expect(totalNoLote('Conforme análise (referência 2 t/ha)', lote)).toBe('0,9 t');
  });
  it('NÃO calcula para recipiente, m², m³ ou calda (antes isso saía errado)', () => {
    expect(totalNoLote('2–3 sementes/recipiente a 1 cm · 5 kg SSP/m³ de substrato', lote)).toBeNull();
    expect(totalNoLote('80–100 g/m² de canteiro', lote)).toBeNull();
    expect(totalNoLote('30 mL / 10 L de água — a cada 3 dias', lote)).toBeNull();
  });
  it('sem plantas/área informadas → null', () => {
    expect(totalNoLote('30 g/planta', {})).toBeNull();
    expect(totalNoLote('60 kg/ha', { plantas: 10 })).toBeNull();
  });
});

describe('categoriaDaEtapa — etapa do guia → categoria do Anotar', () => {
  const c = (tipo, etapa, forma = '') => categoriaDaEtapa({ tipo, etapa, forma });
  it('por tipo', () => {
    expect(c('foliar', 'Crop Set')).toBe('adubacao_foliar');
    expect(c('aplicacao', 'MIP')).toBe('defensivo');
    expect(c('colheita', 'Colheita')).toBe('colheita');
    expect(c('adubo', 'Cobertura')).toBe('adubacao_solo');
    expect(c('adubo', 'MAP 11-52', 'aplicar por fertirrigação')).toBe('fertirrigacao');
  });
  it('manejo pelo texto', () => {
    expect(c('manejo', 'Irrigação — fase inicial')).toBe('irrigacao');
    expect(c('manejo', 'Condução em haste única (desbrota)')).toBe('poda');
    expect(c('especial', 'Transplante ao campo')).toBe('plantio');
    expect(c('manejo', 'Verificação de enraizamento')).toBe('monitoramento');
    expect(c('manejo', 'Algo diferente')).toBe('outros');
  });
});
