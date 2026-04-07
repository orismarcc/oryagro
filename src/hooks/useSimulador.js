import { useMemo } from 'react';

const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function calcularPlantas(cultura, valores) {
  const isCampo = cultura.tipo === 'campo';
  if (isCampo) {
    const areaHa = parseFloat(valores.areaHa) || cultura.area.padrao;
    const spacingL = parseFloat(valores.espacamentoLinhas) || cultura.espacamento.linhas;
    const spacingP = parseFloat(valores.espacamentoPlantas) || cultura.espacamento.plantas;
    const plantasPorHa = spacingL > 0 && spacingP > 0 ? Math.floor(10000 / (spacingL * spacingP)) : 0;
    const totalPlantas = Math.round(plantasPorHa * areaHa);
    return { isCampo, areaHa, areaMq: areaHa * 10000, plantasPorHa, totalPlantas };
  } else {
    const comp = parseFloat(valores.comprimento) || cultura.canteiro.comprimento;
    const larg = parseFloat(valores.largura) || cultura.canteiro.largura;
    const spacingL = parseFloat(valores.espacamentoLinhas) || cultura.canteiro.espacamentoLinhas;
    const spacingP = parseFloat(valores.espacamentoPlantas) || cultura.canteiro.espacamentoPlantas;
    const area = comp * larg;
    const linhas = spacingL > 0 ? Math.floor(larg / spacingL) : 0;
    const porLinha = spacingP > 0 ? Math.floor(comp / spacingP) : 0;
    const totalPlantas = linhas * porLinha;
    return { isCampo, area, linhas, porLinha, totalPlantas, comp, larg, spacingL, spacingP };
  }
}

export function useSimulador(cultura, valores) {
  return useMemo(() => {
    const isCampo = cultura.tipo === 'campo';
    const dim = calcularPlantas(cultura, valores);
    const ins = cultura.insumos;

    // ── Preços por unidade (editáveis) ──
    const precoCalcareo  = parseFloat(valores.precoCalcareo)  || 0.55;
    const precoEsterco   = parseFloat(valores.precoEsterco)   || (isCampo ? 0.08 : 0.80);
    const precoNPK       = parseFloat(valores.precoNPK)       || (isCampo ? 2.50 : 8.00);
    const precoUreia     = parseFloat(valores.precoUreia)     || 4.00;
    const precoNitratoCa = parseFloat(valores.precoNitratoCa) || 12.00;

    let custoCalcareo, custoEsterco, custoNPK, custoUreia, custoNitratoCa, custoSementes;

    if (isCampo) {
      const ha = dim.areaHa || 1;
      custoCalcareo  = (parseFloat(valores.calcareo)      || ins.calcareo.padrao)      * ha * precoCalcareo;
      custoEsterco   = (parseFloat(valores.esterco)       || ins.esterco.padrao)       * ha * precoEsterco;
      custoNPK       = (parseFloat(valores.npk)           || ins.npk.padrao)           * ha * precoNPK;
      custoUreia     = (parseFloat(valores.ureia)         || ins.ureia.padrao)         * ha * precoUreia;
      custoNitratoCa = (parseFloat(valores.nitratoCalcio) || ins.nitratoCalcio.padrao) * ha * precoNitratoCa;
      custoSementes  = ins.sementes.padrao * ha * ins.sementes.precoUnitario;
    } else {
      custoCalcareo  = (parseFloat(valores.calcareo)      || ins.calcareo.padrao)              * precoCalcareo;
      custoEsterco   = (parseFloat(valores.esterco)       || ins.esterco.padrao)               * precoEsterco;
      custoNPK       = (parseFloat(valores.npk)           || ins.npk.padrao)                   * precoNPK;
      custoUreia     = ((parseFloat(valores.ureia)        || ins.ureia.padrao) / 1000)          * precoUreia;
      custoNitratoCa = ((parseFloat(valores.nitratoCalcio)|| ins.nitratoCalcio.padrao) / 1000)  * precoNitratoCa;
      const fator    = (dim.area || 32) / 32;
      custoSementes  = ins.sementes.padrao * ins.sementes.precoUnitario * fator;
    }

    const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
      ? (dim.area || 0) * ins.mulching.multiplicador * (parseFloat(valores.precoMulching) || 2.10)
      : 0;
    const custoMOD = parseFloat(valores.modObra) || ins.modObra.padrao;

    // ── Custos adicionais de produção ──
    const custoEmbalagem   = parseFloat(valores.custoEmbalagem)   ?? (isCampo ? 0 : 18);
    const custoTransporte  = parseFloat(valores.custoTransporte)  ?? 20;
    const custoDefensivos  = parseFloat(valores.custoDefensivos)  ?? (isCampo ? 80 : 35);
    const custoEnergia     = parseFloat(valores.custoEnergia)     ?? 25;

    const custoTotal = custoCalcareo + custoEsterco + custoNPK + custoUreia +
                       custoNitratoCa + custoSementes + custoMulching + custoMOD +
                       custoEmbalagem + custoTransporte + custoDefensivos + custoEnergia;

    const precoVenda    = parseFloat(valores.precoVenda)    || cultura.venda.precoUnitario;
    const sobrevivencia = parseFloat(valores.sobrevivencia) || cultura.venda.sobrevivencia;
    const plantasViaveis = Math.round(dim.totalPlantas * sobrevivencia / 100);

    let receita;
    if (isCampo && cultura.venda.producaoKgPorHa) {
      receita = cultura.venda.producaoKgPorHa * (dim.areaHa || 1) * precoVenda;
    } else {
      receita = plantasViaveis * precoVenda;
    }

    const lucro   = receita - custoTotal;
    const margem  = receita > 0 ? (lucro / receita) * 100 : 0;
    const custoPlanta = dim.totalPlantas > 0 ? custoTotal / dim.totalPlantas : 0;
    const pontoEquilibrio = precoVenda > 0 ? Math.ceil(custoTotal / precoVenda) : 0;

    const composicaoCustos = [
      { name: 'Calcário',       value: +custoCalcareo.toFixed(2),    fill: '#52b788' },
      { name: 'Esterco',        value: +custoEsterco.toFixed(2),     fill: '#7b4f12' },
      { name: 'NPK',            value: +custoNPK.toFixed(2),         fill: '#1e4d2b' },
      { name: 'Ureia',          value: +custoUreia.toFixed(2),       fill: '#40916c' },
      { name: 'Sementes/Mudas', value: +custoSementes.toFixed(2),    fill: '#d4a017' },
      { name: 'Mão de Obra',    value: +custoMOD.toFixed(2),         fill: '#b5451b' },
      { name: 'Mulching',       value: +custoMulching.toFixed(2),    fill: '#8e8e8e' },
      { name: 'Embalagem',      value: +custoEmbalagem.toFixed(2),   fill: '#7c3aed' },
      { name: 'Transporte',     value: +custoTransporte.toFixed(2),  fill: '#2563eb' },
      { name: 'Defensivos',     value: +custoDefensivos.toFixed(2),  fill: '#dc2626' },
      { name: 'Energia',        value: +custoEnergia.toFixed(2),     fill: '#0891b2' },
    ].filter(c => c.value > 0);

    return {
      ...dim,
      plantasViaveis,
      custoTotal, custoPlanta,
      receita, lucro, margem,
      pontoEquilibrio,
      composicaoCustos,
      formatBRL, isCampo,
    };
  }, [cultura, valores]);
}
