import { describe, it, expect } from 'vitest';
import {
  calcularManejoIrrigacao, kcCultura, laminaParaLitros,
  taxaAplicacaoMmH, tempoIrrigacao, resolverTaxaTalhao, eficienciaPadrao,
} from './clima';

function prev(dias) {
  return {
    daily: {
      time: dias.map(d => d.data),
      et0: dias.map(d => d.et0),
      chuva: dias.map(d => d.chuva),
      tmax: dias.map(d => d.tmax ?? 30),
      tmin: dias.map(d => d.tmin ?? 18),
      probChuva: dias.map(d => d.prob ?? 0),
    },
  };
}

describe('calcularManejoIrrigacao', () => {
  const hojeISO = '2026-07-23';

  it('recomenda irrigar quando ETc > chuva', () => {
    const p = prev([
      { data: '2026-07-23', et0: 5, chuva: 0 },
      { data: '2026-07-24', et0: 5, chuva: 0 },
      { data: '2026-07-25', et0: 5, chuva: 0 },
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.recomendacao.nivel).toBe('irrigar');
    expect(r.dias[0].necessidade).toBe(5);          // 5*1 - 0
    expect(r.totalNecessidade7).toBe(15);
  });

  it('aplica o Kc na demanda', () => {
    const p = prev([{ data: '2026-07-23', et0: 4, chuva: 0 }]);
    const r = calcularManejoIrrigacao(p, { kc: 1.2, hojeISO });
    expect(r.dias[0].etc).toBe(4.8);
    expect(r.dias[0].necessidade).toBe(4.8);
  });

  it('manda segurar quando a chuva cobre a demanda', () => {
    const p = prev([
      { data: '2026-07-23', et0: 4, chuva: 20 },
      { data: '2026-07-24', et0: 4, chuva: 10 },
      { data: '2026-07-25', et0: 4, chuva: 10 },
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.recomendacao.nivel).toBe('segurar');
    expect(r.dias[0].necessidade).toBe(0);          // chuva > ETc
  });

  it('marca dias passados como não-futuros e não os conta nos totais', () => {
    const p = prev([
      { data: '2026-07-21', et0: 9, chuva: 0 },     // passado
      { data: '2026-07-23', et0: 5, chuva: 0 },     // hoje
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.dias.find(d => d.data === '2026-07-21').futuro).toBe(false);
    expect(r.totalNecessidade7).toBe(5);            // só hoje conta
  });

  it('lida com previsão vazia sem quebrar', () => {
    const r = calcularManejoIrrigacao({ daily: { time: [] } }, {});
    expect(r.dias).toEqual([]);
    expect(r.recomendacao).toBeNull();
  });
});

describe('sistema de irrigação — taxa e tempo de acionamento', () => {
  it('deriva taxa mm/h de vazão ÷ área do emissor (1 L/m² = 1 mm)', () => {
    // gotejador 2 L/h, espaçamento 0,5 × 0,3 m = 0,15 m² → 13,33 mm/h
    expect(taxaAplicacaoMmH({ vazaoLh: 2, areaEmissorM2: 0.15 })).toBe(13.33);
    // microaspersor 50 L/h cobrindo 10 m² → 5 mm/h
    expect(taxaAplicacaoMmH({ vazaoLh: 50, areaEmissorM2: 10 })).toBe(5);
  });

  it('retorna null quando faltam dados para a taxa', () => {
    expect(taxaAplicacaoMmH({ vazaoLh: 0, areaEmissorM2: 10 })).toBeNull();
    expect(taxaAplicacaoMmH({ vazaoLh: 2, areaEmissorM2: 0 })).toBeNull();
  });

  it('calcula o tempo compensando a eficiência do sistema', () => {
    // precisa 5 mm líquidos, sistema aplica 10 mm/h com 100% eficiência → 30 min
    const t1 = tempoIrrigacao({ laminaMm: 5, taxaMmH: 10, eficiencia: 1 });
    expect(t1.minutosTotais).toBe(30);
    expect(t1.laminaBruta).toBe(5);

    // mesma lâmina com aspersão (75%) → precisa aplicar 6,67 mm → 40 min
    const t2 = tempoIrrigacao({ laminaMm: 5, taxaMmH: 10, eficiencia: 0.75 });
    expect(t2.laminaBruta).toBe(6.7);
    expect(t2.minutosTotais).toBe(40);
  });

  it('formata horas e minutos', () => {
    const t = tempoIrrigacao({ laminaMm: 12, taxaMmH: 5, eficiencia: 0.8 });
    // bruta 15 mm ÷ 5 mm/h = 3 h
    expect(t.h).toBe(3);
    expect(t.min).toBe(0);
  });

  it('retorna null com dados inválidos', () => {
    expect(tempoIrrigacao({ laminaMm: 0, taxaMmH: 10, eficiencia: 0.9 })).toBeNull();
    expect(tempoIrrigacao({ laminaMm: 5, taxaMmH: 0, eficiencia: 0.9 })).toBeNull();
    expect(tempoIrrigacao({ laminaMm: 5, taxaMmH: 10, eficiencia: 1.5 })).toBeNull();
  });

  it('resolverTaxaTalhao prioriza a taxa informada e cai para a derivada', () => {
    expect(resolverTaxaTalhao({ irrigacao_taxa_mm_h: 8 })).toBe(8);
    expect(resolverTaxaTalhao({ irrigacao_vazao_emissor_lh: 2, irrigacao_area_emissor_m2: 0.5 })).toBe(4);
    expect(resolverTaxaTalhao({})).toBeNull();
  });

  it('eficiência padrão por tipo de sistema', () => {
    expect(eficienciaPadrao('gotejamento')).toBe(0.90);
    expect(eficienciaPadrao('aspersao')).toBe(0.75);
    expect(eficienciaPadrao('inexistente')).toBe(0.8);
  });
});

describe('kcCultura e laminaParaLitros', () => {
  it('retorna Kc conhecido e default 1.0', () => {
    expect(kcCultura('milho')).toBe(1.2);
    expect(kcCultura('desconhecida')).toBe(1.0);
  });
  it('converte lâmina em litros (1 mm = 10.000 L/ha)', () => {
    expect(laminaParaLitros(5, 2)).toBe(100_000);   // 5 mm × 2 ha
    expect(laminaParaLitros(0, 5)).toBe(0);
    expect(laminaParaLitros(5, 0)).toBe(0);
  });
});
