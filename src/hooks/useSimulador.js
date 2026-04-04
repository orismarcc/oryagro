import { useMemo } from 'react';

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function useSimulador(cultura, valores) {
  return useMemo(() => {
    const area = valores.comprimento * valores.largura;

    const custoCalcareo = (valores.calcareo || 0) * 0.55;
    const custoEsterco = (valores.esterco || 0) * 0.80;
    const custoNPK = (valores.npk || 0) * 8.00;
    const custoUreia = ((valores.ureia || 0) / 1000) * 4.00;
    const custoNitratoCa = ((valores.nitratoCalcio || 0) / 1000) * 12.00;
    const custoSementes = (valores.quantSementes || cultura.insumos.sementes.padrao) * cultura.insumos.sementes.precoUnitario;
    const custoMulching = cultura.insumos.mulching.multiplicador > 0 ? area * cultura.insumos.mulching.multiplicador * 2.10 : 0;
    const custoMOD = valores.modObra || cultura.insumos.modObra.padrao;

    const custoTotal = custoCalcareo + custoEsterco + custoNPK + custoUreia + custoNitratoCa + custoSementes + custoMulching + custoMOD;

    const linhas = Math.floor(valores.largura / cultura.canteiro.espacamentoLinhas);
    const plantasPorLinha = Math.floor(valores.comprimento / cultura.canteiro.espacamentoPlantas);
    const totalPlantas = linhas * plantasPorLinha;
    const plantasViaveis = Math.round(totalPlantas * (valores.sobrevivencia || cultura.venda.sobrevivencia) / 100);

    const receita = plantasViaveis * (valores.precoVenda || cultura.venda.precoUnitario);
    const lucro = receita - custoTotal;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const custoPlanta = totalPlantas > 0 ? custoTotal / totalPlantas : 0;
    const pontoEquilibrio = (valores.precoVenda || cultura.venda.precoUnitario) > 0
      ? Math.ceil(custoTotal / (valores.precoVenda || cultura.venda.precoUnitario))
      : 0;

    const composicaoCustos = [
      { name: 'Calcário', value: parseFloat(custoCalcareo.toFixed(2)), fill: '#52b788' },
      { name: 'Esterco', value: parseFloat(custoEsterco.toFixed(2)), fill: '#7b4f12' },
      { name: 'NPK', value: parseFloat(custoNPK.toFixed(2)), fill: '#1e4d2b' },
      { name: 'Ureia', value: parseFloat(custoUreia.toFixed(2)), fill: '#40916c' },
      { name: 'Sementes/Mudas', value: parseFloat(custoSementes.toFixed(2)), fill: '#d4a017' },
      { name: 'Mão de Obra', value: parseFloat(custoMOD.toFixed(2)), fill: '#b5451b' },
      { name: 'Mulching', value: parseFloat(custoMulching.toFixed(2)), fill: '#8e8e8e' },
    ].filter(c => c.value > 0);

    return {
      area,
      totalPlantas,
      plantasViaveis,
      custoTotal,
      custoPlanta,
      receita,
      lucro,
      margem,
      pontoEquilibrio,
      composicaoCustos,
      formatBRL,
    };
  }, [cultura, valores]);
}
