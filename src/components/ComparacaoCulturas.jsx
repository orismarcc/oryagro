import React from 'react';
import { Card } from './ui/card';
import { CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';

function CulturaRow({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  const isCampo = cultura.tipo === 'campo';
  const defaults = isCampo
    ? {
        areaHa: cultura.area.padrao,
        espacamentoLinhas: cultura.espacamento.linhas,
        espacamentoPlantas: cultura.espacamento.plantas,
        calcareo: cultura.insumos.calcareo.padrao,
        esterco: cultura.insumos.esterco.padrao,
        npk: cultura.insumos.npk.padrao,
        ureia: cultura.insumos.ureia.padrao,
        nitratoCalcio: cultura.insumos.nitratoCalcio.padrao,
        modObra: cultura.insumos.modObra.padrao,
        precoVenda: cultura.venda.precoUnitario,
        sobrevivencia: cultura.venda.sobrevivencia,
      }
    : {
        comprimento: cultura.canteiro.comprimento,
        largura: cultura.canteiro.largura,
        espacamentoLinhas: cultura.canteiro.espacamentoLinhas,
        espacamentoPlantas: cultura.canteiro.espacamentoPlantas,
        calcareo: cultura.insumos.calcareo.padrao,
        esterco: cultura.insumos.esterco.padrao,
        npk: cultura.insumos.npk.padrao,
        ureia: cultura.insumos.ureia.padrao,
        nitratoCalcio: cultura.insumos.nitratoCalcio.padrao,
        modObra: cultura.insumos.modObra.padrao,
        precoVenda: cultura.venda.precoUnitario,
        sobrevivencia: cultura.venda.sobrevivencia,
      };
  const r = useSimulador(cultura, saved || defaults);

  const margemBg = r.margem >= 50
    ? 'bg-verde-100 text-verde-800'
    : r.margem >= 20
    ? 'bg-dourado-100 text-terra-600'
    : 'bg-ambar-100 text-ambar-600';

  return (
    <tr className="border-b border-borda hover:bg-papel transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cultura.cor }} />
          <span className="font-semibold text-sm">{cultura.nome}</span>
          {isCampo && (
            <span className="text-[10px] text-ambar-600 font-bold bg-ambar-50 border border-ambar-100 rounded px-1.5 py-0.5">campo</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{cultura.ciclo}</td>
      <td className="px-4 py-3 text-sm">{r.formatBRL(r.custoTotal)}</td>
      <td className="px-4 py-3 text-sm">{r.formatBRL(r.receita)}</td>
      <td className="px-4 py-3 text-sm font-bold" style={{ color: r.lucro >= 0 ? '#1e4d2b' : '#c0392b' }}>{r.formatBRL(r.lucro)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${margemBg}`}>
          {r.margem.toFixed(1)}%
        </span>
      </td>
    </tr>
  );
}

export default function ComparacaoCulturas() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-display font-bold text-gray-900 mb-1">Comparação entre Culturas</h2>
      <p className="text-sm text-gray-500 mb-5">Valores refletem os parâmetros editados individualmente em cada simulador.</p>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-verde-800 text-white text-xs">
              <th className="text-left px-4 py-3">Cultura</th>
              <th className="text-left px-4 py-3">Ciclo</th>
              <th className="text-left px-4 py-3">Custo</th>
              <th className="text-left px-4 py-3">Receita</th>
              <th className="text-left px-4 py-3">Lucro</th>
              <th className="text-left px-4 py-3">Margem</th>
            </tr>
          </thead>
          <tbody>
            {CULTURAS_LIST.map(c => <CulturaRow key={c.id} cultura={c} />)}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
