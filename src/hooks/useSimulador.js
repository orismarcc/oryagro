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

    let custoCalcareo, custoEsterco, custoNPK, custoUreia, custoNitratoCa, custoSementes;

    if (isCampo) {
      const ha = dim.areaHa || 1;
      custoCalcareo  = (parseFloat(valores.calcareo)       || ins.calcareo.padrao)       * ha * 0.55;
      custoEsterco   = (parseFloat(valores.esterco)        || ins.esterco.padrao)        * ha * 0.08;
      custoNPK       = (parseFloat(valores.npk)            || ins.npk.padrao)            * ha * 2.50;
      custoUreia     = (parseFloat(valores.ureia)          || ins.ureia.padrao)          * ha * 4.00;
      custoNitratoCa = (parseFloat(valores.nitratoCalcio)  || ins.nitratoCalcio.padrao)  * ha * 12.00;
      custoSementes  = ins.sementes.padrao * ha * ins.sementes.precoUnitario;
    } else {
      custoCalcareo  = (parseFloat(valores.calcareo)       || ins.calcareo.padrao)       * 0.55;
      custoEsterco   = (parseFloat(valores.esterco)        || ins.esterco.padrao)        * 0.80;
      custoNPK       = (parseFloat(valores.npk)            || ins.npk.padrao)            * 8.00;
      custoUreia     = ((parseFloat(valores.ureia)         || ins.ureia.padrao) / 1000)  * 4.00;
      custoNitratoCa = ((parseFloat(valores.nitratoCalcio) || ins.nitratoCalcio.padrao) / 1000) * 12.00;
      const fator = (dim.area || 32) / 32;
      custoSementes  = ins.sementes.padrao * ins.sementes.precoUnitario * fator;
    }

    const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
      ? (dim.area || 0) * ins.mulching.multiplicador * 2.10
      : 0;
    const custoMOD = parseFloat(valores.modObra) || ins.modObra.padrao;

    const custoTotal = custoCalcareo + custoEsterco + custoNPK + custoUreia +
                       custoNitratoCa + custoSementes + custoMulching + custoMOD;

    const precoVenda   = parseFloat(valores.precoVenda)   || cultura.venda.precoUnitario;
    const sobrevivencia = parseFloat(valores.sobrevivencia) || cultura.venda.sobrevivencia;
    const plantasViaveis = Math.round(dim.totalPlantas * sobrevivencia / 100);

    let receita;
    if (isCampo && cultura.id === 'mandioca') {
      receita = (cultura.venda.producaoKgPorHa || 20000) * (dim.areaHa || 1) * precoVenda;
    } else {
      receita = plantasViaveis * precoVenda;
    }

    const lucro   = receita - custoTotal;
    const margem  = receita > 0 ? (lucro / receita) * 100 : 0;
    const custoPlanta = dim.totalPlantas > 0 ? custoTotal / dim.totalPlantas : 0;
    const pontoEquilibrio = precoVenda > 0 ? Math.ceil(custoTotal / precoVenda) : 0;

    const composicaoCustos = [
      { name: 'Calcário',       value: +custoCalcareo.toFixed(2),  fill: '#52b788' },
      { name: 'Esterco',        value: +custoEsterco.toFixed(2),   fill: '#7b4f12' },
      { name: 'NPK',            value: +custoNPK.toFixed(2),       fill: '#1e4d2b' },
      { name: 'Ureia',          value: +custoUreia.toFixed(2),     fill: '#40916c' },
      { name: 'Sementes/Mudas', value: +custoSementes.toFixed(2),  fill: '#d4a017' },
      { name: 'Mão de Obra',    value: +custoMOD.toFixed(2),       fill: '#b5451b' },
      { name: 'Mulching',       value: +custoMulching.toFixed(2),  fill: '#8e8e8e' },
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
