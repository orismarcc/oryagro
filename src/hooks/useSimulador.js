import { useMemo } from 'react';
import { getPrecosPadrao, getOpCosts } from '../data/precos';
import { FALLBACK_CURVES } from './useCurvasProducao';

/** Fator de produção (0–1) de uma cultura no ano N após o plantio (curva de maturação). */
function fatorProducao(culturaId, ano) {
  const curva = FALLBACK_CURVES[culturaId] || FALLBACK_CURVES._default;
  if (ano <= 0) return curva[0] ?? 0;
  if (ano < curva.length) return curva[ano];
  return curva[curva.length - 1]; // produção plena a partir do fim da curva
}

const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function calcularPlantas(cultura, valores) {
  const isCampo = cultura.tipo === 'campo';
  if (isCampo) {
    const areaHa = parseFloat(valores.areaHa) || cultura.area.padrao;
    const areaMq = areaHa * 10000;
    const spacingL = parseFloat(valores.espacamentoLinhas) || cultura.espacamento.linhas;
    const spacingP = parseFloat(valores.espacamentoPlantas) || cultura.espacamento.plantas;
    const plantasPorHa = spacingL > 0 && spacingP > 0 ? Math.floor(10000 / (spacingL * spacingP)) : 0;
    const totalPlantas = Math.round(plantasPorHa * areaHa);

    // ── Layout em linhas ──────────────────────────────────────────────────
    // Nº de linhas: informado pelo usuário ou estimado assumindo talhão ~quadrado.
    // Comprimento de cada linha decorre da área: L = área / (nº linhas × esp. linhas).
    const numLinhasDefault = spacingL > 0 ? Math.max(1, Math.round(Math.sqrt(areaMq) / spacingL)) : 1;
    const numLinhas = Math.max(1, parseInt(valores.numLinhas, 10) || numLinhasDefault);
    const comprimentoLinha = (numLinhas > 0 && spacingL > 0) ? (areaMq / (numLinhas * spacingL)) : 0;
    const plantasPorLinha = spacingP > 0 ? Math.floor(comprimentoLinha / spacingP) : 0;

    // ── Estacas/mourões da espaldeira ─────────────────────────────────────
    // Uma linha de mourões por linha de plantas (mesmo esp. de entre-linhas).
    let estacas = 0, espEstaca = 0;
    if (cultura.espaldeira) {
      espEstaca = parseFloat(valores.espEstaca) || cultura.espaldeira.espacamentoMourao || 5;
      const mouroesPorLinha = espEstaca > 0 ? Math.floor(comprimentoLinha / espEstaca) + 1 : 0;
      estacas = numLinhas * mouroesPorLinha;
    }

    return {
      isCampo, areaHa, areaMq, plantasPorHa, totalPlantas,
      numLinhas, numLinhasDefault, comprimentoLinha, plantasPorLinha,
      estacas, espEstaca,
    };
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

    // ── Modelo POR PLANTA ─────────────────────────────────────────────────
    // As exigências das culturas são cadastradas por hectare no espaçamento
    // PADRÃO. Convertemos para "por planta" dividindo pela densidade de
    // referência (plantas/ha no espaçamento padrão) e re-escalamos pelo nº de
    // plantas real. Assim adubação, mão de obra, insumos, PRODUÇÃO e custos
    // acompanham a densidade — não apenas a área. `escala` é o nº de hectares
    // "equivalentes em plantas": no espaçamento padrão, escala == área.
    const densRefCampo = Math.max(1, Math.floor(
      10000 / ((cultura.espacamento?.linhas || 1) * (cultura.espacamento?.plantas || 1)),
    ));
    const escala = isCampo ? ((dim.totalPlantas || 0) / densRefCampo) : ((dim.area || 32) / 32);

    // ── Preços por unidade (editáveis) ──
    const pp = getPrecosPadrao(isCampo);
    const precoCalcareo  = parseFloat(valores.precoCalcareo)  || pp.precoCalcareo;
    const precoEsterco   = parseFloat(valores.precoEsterco)   || pp.precoEsterco;
    const precoNPK       = parseFloat(valores.precoNPK)       || pp.precoNPK;
    const precoUreia     = parseFloat(valores.precoUreia)     || pp.precoUreia;
    const precoNitratoCa = parseFloat(valores.precoNitratoCa) || pp.precoNitratoCa;

    const precoSementes  = parseFloat(valores.precoSementes) || ins.sementes.precoUnitario;

    let custoCalcareo, custoEsterco, custoNPK, custoUreia, custoNitratoCa, custoSementes;

    if (isCampo) {
      // Escala por densidade de plantas (não só por área): adubação e insumos
      // acompanham quantas plantas realmente existem.
      const e = escala;
      custoCalcareo  = (parseFloat(valores.calcareo)      || ins.calcareo.padrao)      * e * precoCalcareo;
      custoEsterco   = (parseFloat(valores.esterco)       || ins.esterco.padrao)       * e * precoEsterco;
      custoNPK       = (parseFloat(valores.npk)           || ins.npk.padrao)           * e * precoNPK;
      custoUreia     = (parseFloat(valores.ureia)         || ins.ureia.padrao)         * e * precoUreia;
      custoNitratoCa = (parseFloat(valores.nitratoCalcio) || ins.nitratoCalcio.padrao) * e * precoNitratoCa;
      // Mudas/sementes: custo por planta × nº de plantas real.
      custoSementes  = (dim.totalPlantas || 0) * precoSementes;
    } else {
      custoCalcareo  = (parseFloat(valores.calcareo)      || ins.calcareo.padrao)              * precoCalcareo;
      custoEsterco   = (parseFloat(valores.esterco)       || ins.esterco.padrao)               * precoEsterco;
      custoNPK       = (parseFloat(valores.npk)           || ins.npk.padrao)                   * precoNPK;
      custoUreia     = ((parseFloat(valores.ureia)        || ins.ureia.padrao) / 1000)          * precoUreia;
      custoNitratoCa = ((parseFloat(valores.nitratoCalcio)|| ins.nitratoCalcio.padrao) / 1000)  * precoNitratoCa;
      const fator    = (dim.area || 32) / 32;
      custoSementes  = ins.sementes.padrao * precoSementes * fator;
    }

    const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
      ? (dim.area || 0) * ins.mulching.multiplicador * (parseFloat(valores.precoMulching) || pp.precoMulching)
      : 0;
    // Mão de obra também escala com o nº de plantas (mais plantas = mais manejo).
    const custoMOD = (parseFloat(valores.modObra) || ins.modObra.padrao) * (isCampo ? escala : 1);

    // ── Estacas/mourões da espaldeira (maracujá, uva…) ──
    const valorEstaca = parseFloat(valores.valorEstaca) || ins.mouroes?.precoUnitario || 18;
    const custoEstacas = cultura.espaldeira ? (dim.estacas || 0) * valorEstaca : 0;

    // ── Custos adicionais de produção ──
    const op = getOpCosts(cultura.id, isCampo);
    const custoEmbalagem   = parseFloat(valores.custoEmbalagem)  >= 0 ? parseFloat(valores.custoEmbalagem)  : op.embalagem;
    const custoTransporte  = parseFloat(valores.custoTransporte) >= 0 ? parseFloat(valores.custoTransporte) : op.transporte;
    const custoDefensivos  = parseFloat(valores.custoDefensivos) >= 0 ? parseFloat(valores.custoDefensivos) : op.defensivos;
    const custoEnergia     = parseFloat(valores.custoEnergia)    >= 0 ? parseFloat(valores.custoEnergia)    : op.energia;

    const custoTotal = custoCalcareo + custoEsterco + custoNPK + custoUreia +
                       custoNitratoCa + custoSementes + custoMulching + custoMOD +
                       custoEstacas +
                       custoEmbalagem + custoTransporte + custoDefensivos + custoEnergia;

    const precoVenda    = parseFloat(valores.precoVenda)    || cultura.venda.precoUnitario;
    const sobrevivencia = parseFloat(valores.sobrevivencia) != null && valores.sobrevivencia !== ''
      ? parseFloat(valores.sobrevivencia)
      : cultura.venda.sobrevivencia;
    const plantasViaveis = Math.round(dim.totalPlantas * sobrevivencia / 100);

    // ── Receita — choose production model ──
    // 1) Campo with producaoKgPorHa (quiabo, mandioca, acerola, banana)
    // 2) Canteiro with producaoBase (couve, cebolinha, coentro, rúcula — multi-harvest / area-based)
    // 3) Default: plant count (alface, abacaxi)
    let receita, producaoTotal;
    const v = cultura.venda;

    if (isCampo && (v.producaoKgPorHa || valores.producaoKgPorHa)) {
      // Produção por PLANTA × nº de plantas (via escala), não só por área — assim
      // um espaçamento maior (menos plantas) produz menos, e vice-versa.
      const baseKgHa = parseFloat(valores.producaoKgPorHa) || v.producaoKgPorHa || 0;
      producaoTotal = baseKgHa * escala * (sobrevivencia / 100);
      receita       = producaoTotal * precoVenda;
    } else if (v.producaoBase != null || valores.producaoBase != null) {
      // producaoBase = total sellable units per canteiro at 100% (before sobrevivência)
      const base = parseFloat(valores.producaoBase) || v.producaoBase || 0;
      producaoTotal = Math.round(base * (sobrevivencia / 100));
      receita       = producaoTotal * precoVenda;
    } else {
      producaoTotal = plantasViaveis;
      receita       = plantasViaveis * precoVenda;
    }

    const lucro   = receita - custoTotal;
    const margem  = receita > 0 ? (lucro / receita) * 100 : 0;
    const custoPlanta = dim.totalPlantas > 0 ? custoTotal / dim.totalPlantas : 0;

    // ── Período do resultado ──
    // Perenes (produção por ano) → "ano"; anuais → "ciclo/safra".
    const periodo = cultura.tipoCultura === 'perene' ? 'ano' : 'ciclo';

    // ── Ponto de equilíbrio ──
    // Volume de produção (na mesma unidade da 'produção estimada') necessário
    // para cobrir os custos, e a fração da produção que isso representa.
    const unidadeVenda = cultura.venda?.unidade || 'un';
    const pontoEquilibrio = precoVenda > 0 ? Math.ceil(custoTotal / precoVenda) : 0;
    const pontoEquilibrioPct = producaoTotal > 0 ? (pontoEquilibrio / producaoTotal) * 100 : null;

    // ── Base para "meta de lucro" (goal-seek) ──
    // Lucro por hectare-equivalente (por planta), usado para dimensionar quanto
    // seria necessário para atingir uma meta de lucro/ano informada pelo usuário.
    const lucroPorEscala = escala > 0 ? lucro / escala : 0;

    // ── Projeção multi-ano (culturas perenes) ──────────────────────────────
    // Ano 1 = implantação (custo total, produção parcial pela curva de maturação).
    // Anos seguintes = manutenção (subconjunto recorrente dos custos), com a
    // produção subindo pela curva até a plena. Calcula o fluxo acumulado e o
    // ANO DE PAYBACK (quando o acumulado passa a positivo).
    let projecaoMultiAno = null, paybackAno = null, custoImplantacao = null, custoManutencao = null;
    if (cultura.tipoCultura === 'perene') {
      const vidaUtil = Math.min(cultura.vidaUtilAnos || 10, 12); // teto de exibição
      const receitaPlena = receita; // 'receita' já é a produção plena anual desta densidade
      custoImplantacao = custoTotal;
      // Recorrente: adubação de cobertura + defensivos + operacionais + manejo/colheita.
      // Exclui itens de implantação (calcário, esterco, mudas, estacas, ~cova/formação).
      custoManutencao = custoUreia + custoNitratoCa + custoDefensivos + custoEmbalagem +
                        custoTransporte + custoEnergia + custoNPK * 0.4 + custoMOD * 0.6;
      let acumulado = 0;
      projecaoMultiAno = [];
      for (let y = 1; y <= vidaUtil; y++) {
        const fator = fatorProducao(cultura.id, y);
        const receitaY = receitaPlena * fator;
        const custoY = y === 1 ? custoImplantacao : custoManutencao;
        const lucroY = receitaY - custoY;
        acumulado += lucroY;
        if (paybackAno === null && acumulado >= 0) paybackAno = y;
        projecaoMultiAno.push({ ano: y, fator, receita: receitaY, custo: custoY, lucro: lucroY, acumulado });
      }
    }

    const composicaoCustos = [
      { name: 'Calcário',       value: +custoCalcareo.toFixed(2),    fill: '#52b788' },
      { name: 'Esterco',        value: +custoEsterco.toFixed(2),     fill: '#7b4f12' },
      { name: 'NPK',            value: +custoNPK.toFixed(2),         fill: '#1e4d2b' },
      { name: 'Ureia',          value: +custoUreia.toFixed(2),       fill: '#40916c' },
      { name: 'Sementes/Mudas', value: +custoSementes.toFixed(2),    fill: '#d4a017' },
      { name: 'Estacas',        value: +custoEstacas.toFixed(2),     fill: '#7b4f12' },
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
      producaoTotal,
      custoTotal, custoPlanta,
      receita, lucro, margem,
      pontoEquilibrio, pontoEquilibrioPct, unidadeVenda,
      periodo, escala, densRef: densRefCampo, lucroPorEscala,
      projecaoMultiAno, paybackAno, custoImplantacao, custoManutencao,
      composicaoCustos,
      formatBRL, isCampo,
    };
  }, [cultura, valores]);
}
