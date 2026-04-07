import React from 'react';
import { CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function CulturaRow({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  const isCampo = cultura.tipo === 'campo';
  const defaults = isCampo
    ? { areaHa: cultura.area.padrao, espacamentoLinhas: cultura.espacamento.linhas, espacamentoPlantas: cultura.espacamento.plantas, calcareo: cultura.insumos.calcareo.padrao, esterco: cultura.insumos.esterco.padrao, npk: cultura.insumos.npk.padrao, ureia: cultura.insumos.ureia.padrao, nitratoCalcio: cultura.insumos.nitratoCalcio.padrao, modObra: cultura.insumos.modObra.padrao, precoVenda: cultura.venda.precoUnitario, sobrevivencia: cultura.venda.sobrevivencia }
    : { comprimento: cultura.canteiro.comprimento, largura: cultura.canteiro.largura, espacamentoLinhas: cultura.canteiro.espacamentoLinhas, espacamentoPlantas: cultura.canteiro.espacamentoPlantas, calcareo: cultura.insumos.calcareo.padrao, esterco: cultura.insumos.esterco.padrao, npk: cultura.insumos.npk.padrao, ureia: cultura.insumos.ureia.padrao, nitratoCalcio: cultura.insumos.nitratoCalcio.padrao, modObra: cultura.insumos.modObra.padrao, precoVenda: cultura.venda.precoUnitario, sobrevivencia: cultura.venda.sobrevivencia };
  const r = useSimulador(cultura, saved || defaults);

  const isPositive = r.lucro >= 0;
  const margemColor = r.margem >= 50 ? '#059669' : r.margem >= 20 ? '#d97706' : '#dc2626';
  const MargemIcon = r.margem >= 20 ? TrendingUp : r.margem >= 0 ? Minus : TrendingDown;

  return (
    <div
      className="card-interactive p-4 flex flex-col gap-3"
      style={{ borderLeft: `3px solid ${cultura.cor}` }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${cultura.cor}15` }}
        >
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display text-[15px] font-bold text-foreground">{cultura.nome}</span>
            {isCampo && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: 'hsl(38 90% 93%)', color: 'hsl(38 70% 32%)' }}>
                campo
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{cultura.ciclo}</p>
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
          style={{ background: `${margemColor}15`, color: margemColor }}
        >
          <MargemIcon size={11} />
          {r.margem.toFixed(1)}%
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
          <p className="section-label mb-0.5">Custo</p>
          <p className="text-[13px] font-bold text-foreground">{r.formatBRL(r.custoTotal)}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
          <p className="section-label mb-0.5">Receita</p>
          <p className="text-[13px] font-bold text-foreground">{r.formatBRL(r.receita)}</p>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: isPositive ? 'hsl(152 69% 95%)' : 'hsl(4 80% 96%)' }}
        >
          <p className="section-label mb-0.5">Lucro</p>
          <p className="text-[13px] font-bold" style={{ color: isPositive ? '#059669' : '#dc2626' }}>
            {r.formatBRL(r.lucro)}
          </p>
        </div>
      </div>

      {/* Margin bar */}
      <div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(Math.max(r.margem, 0), 100)}%`,
              background: `linear-gradient(90deg, ${margemColor}80, ${margemColor})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ComparacaoCulturas() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero px-5 pt-6 pb-6">
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Análise</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Comparar Culturas</h1>
        <p className="text-white/50 text-[12px] mt-1">Baseado nos parâmetros do simulador de cada cultura</p>
      </div>

      <div className="px-4 pt-5 pb-4 space-y-3 max-w-2xl mx-auto">
        {CULTURAS_LIST.map(c => <CulturaRow key={c.id} cultura={c} />)}
      </div>
    </div>
  );
}
