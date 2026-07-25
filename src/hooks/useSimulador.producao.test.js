/**
 * Modelo de produção POR CULTURA (bug reportado pelo usuário):
 * o campo dizia "kg/ha" mas o motor reescalava pela densidade — na acerola a
 * 3×4, digitar 24 t/ha mostrava ~32 t. Agora cada cultura declara seu modelo:
 *  - 'planta' (fruteiras): produção = kg/planta × nº de plantas.
 *  - 'ha' (lavouras): produção = kg/ha × área, literal.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('react', () => ({ useMemo: (fn) => fn() }));

const { useSimulador, calcularPlantas } = await import('./useSimulador');
const { CULTURAS } = await import('../data/culturas');

describe('modelo de produção por cultura', () => {
  it('acerola (planta): padrão bate com o kg/ha de referência no espaçamento padrão', () => {
    // 25.000 kg/ha ÷ 625 pl/ha (4×4) = 40 kg/planta → 1 ha a 4×4 = 25.000 kg
    const r = useSimulador(CULTURAS.acerola, { areaHa: 1, sobrevivencia: 100 });
    expect(r.kgPorPlantaPadrao).toBe(40);
    expect(Math.round(r.producaoTotal)).toBe(25000);
  });

  it('acerola (planta): o INPUT kg/planta manda — 3×4 com 28,8 kg/pl ≈ 24 t/ha', () => {
    // Cenário exato do usuário: ele sabe que a 3×4 rende ~24 t/ha.
    // 24.000 ÷ 833 pl = 28,8 kg/planta → produção ≈ 24 t (não mais 32 t).
    const r = useSimulador(CULTURAS.acerola, {
      areaHa: 1, espacamentoLinhas: 3, espacamentoPlantas: 4,
      producaoKgPorPlanta: 28.8, sobrevivencia: 100,
    });
    expect(r.producaoModelo).toBe('planta');
    expect(Math.round(r.producaoTotal)).toBe(Math.round(28.8 * 833));
    expect(r.producaoTotal).toBeGreaterThan(23500);
    expect(r.producaoTotal).toBeLessThan(24500);
  });

  it('acerola (planta): adensar aumenta a produção mantendo o kg/planta', () => {
    const a44 = useSimulador(CULTURAS.acerola, { areaHa: 1, espacamentoLinhas: 4, espacamentoPlantas: 4, sobrevivencia: 100 });
    const a34 = useSimulador(CULTURAS.acerola, { areaHa: 1, espacamentoLinhas: 3, espacamentoPlantas: 4, sobrevivencia: 100 });
    expect(a34.producaoTotal).toBeGreaterThan(a44.producaoTotal); // mais plantas
    expect(a34.kgPorPlanta).toBe(a44.kgPorPlanta);                // mesmo rendimento/pl
  });

  it('mandioca (ha): kg/ha é LITERAL — espaçamento não muda a produção', () => {
    const e11 = useSimulador(CULTURAS.mandioca, { areaHa: 1, espacamentoLinhas: 1, espacamentoPlantas: 1, sobrevivencia: 100 });
    const e21 = useSimulador(CULTURAS.mandioca, { areaHa: 1, espacamentoLinhas: 2, espacamentoPlantas: 1, sobrevivencia: 100 });
    expect(e11.producaoModelo).toBe('ha');
    expect(Math.round(e11.producaoTotal)).toBe(Math.round(e21.producaoTotal));
    expect(Math.round(e11.producaoTotal)).toBe(20000); // padrão da cultura × 1 ha
  });

  it('mandioca (ha): digitar 24 t/ha dá exatamente 24 t em 1 ha', () => {
    const r = useSimulador(CULTURAS.mandioca, { areaHa: 1, producaoKgPorHa: 24000, sobrevivencia: 100 });
    expect(Math.round(r.producaoTotal)).toBe(24000);
  });

  it('todas as culturas de campo com kg/ha declaram o modelo explicitamente', () => {
    for (const c of Object.values(CULTURAS)) {
      if (c.tipo === 'campo' && c.venda?.producaoKgPorHa) {
        expect(['planta', 'ha'], `${c.id} sem producaoModelo`).toContain(c.venda.producaoModelo);
      }
    }
  });
});

describe('comprimento de linha → nº de linhas automático (espaldeira)', () => {
  it('informar o comprimento calcula as linhas: 1 ha, esp. 3 m, linhas de 100 m → 33 linhas', () => {
    const d = calcularPlantas(CULTURAS.maracuja, {
      areaHa: 1, espacamentoLinhas: 3, espacamentoPlantas: 4, comprimentoLinha: 100,
    });
    expect(d.comprimentoLinha).toBe(100);
    expect(d.numLinhas).toBe(33); // round(10000 / (100×3))
  });

  it('estacas seguem: 100 m ÷ 5 m + 1 = 21 estacas/linha × 33 linhas', () => {
    const d = calcularPlantas(CULTURAS.maracuja, {
      areaHa: 1, espacamentoLinhas: 3, espacamentoPlantas: 4, comprimentoLinha: 100, espEstaca: 5,
    });
    expect(d.estacas).toBe(21 * 33);
  });

  it('sem comprimento informado, mantém o comportamento anterior (nº de linhas)', () => {
    const d = calcularPlantas(CULTURAS.maracuja, {
      areaHa: 1, espacamentoLinhas: 3, espacamentoPlantas: 4, numLinhas: 20,
    });
    expect(d.numLinhas).toBe(20);
    expect(Math.round(d.comprimentoLinha)).toBe(Math.round(10000 / (20 * 3)));
  });
});
