/**
 * PropriedadeResumoCard — cartão da propriedade (Início): nº de lotes, área,
 * ativos e culturas. Toque abre a propriedade com os lotes dela.
 */
import React from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle } from '../lib/lifecycle';

const BRAND = 'hsl(156 64% 31%)';

export default function PropriedadeResumoCard({ propriedade, lotes = [], onClick }) {
  const area = Math.round(lotes.reduce((s, l) => s + (parseFloat(l.area_ha) || 0), 0) * 100) / 100;
  const ativos = lotes.filter(l => l.status !== 'concluido').length;
  const emojis = [...new Set(lotes.map(l => l.cultura_id))].map(id => CULTURAS[id]?.emoji).filter(Boolean).slice(0, 6);
  const prontos = lotes.filter(l => {
    const c = CULTURAS[l.cultura_id];
    try { return l.status !== 'concluido' && c && resolveLifecycle(l, c).prontoParaColheita; } catch { return false; }
  }).length;

  return (
    <button onClick={onClick} className="card-interactive w-full text-left overflow-hidden mb-2.5"
      style={{ borderLeft: `3px solid ${BRAND}` }}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(156 64% 31% / 0.1)' }}>
          <Building2 size={19} style={{ color: BRAND }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[14.5px] font-bold text-foreground leading-tight truncate">{propriedade.nome}</p>
            {prontos > 0 && (
              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'hsl(36 92% 50% / 0.16)', color: 'hsl(30 80% 32%)' }}>
                🌾 {prontos} p/ colheita
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{propriedade.descricao || 'Toque para ver os lotes'}</p>
        </div>
        <ChevronRight size={16} className="opacity-40 flex-shrink-0" />
      </div>
      <div className="grid grid-cols-3 gap-px mx-4 mb-3 rounded-xl overflow-hidden" style={{ background: 'hsl(150 16% 91%)' }}>
        {[
          [lotes.length, `lote${lotes.length !== 1 ? 's' : ''}`],
          [area > 0 ? `${area.toLocaleString('pt-BR')} ha` : '—', 'área'],
          [ativos, `ativo${ativos !== 1 ? 's' : ''}`],
        ].map(([v, l]) => (
          <div key={l} className="py-2 text-center" style={{ background: 'hsl(140 20% 97%)' }}>
            <p className="text-[13px] font-black text-foreground leading-none tabular-nums">{v}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{l}</p>
          </div>
        ))}
      </div>
      {emojis.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-3 -mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Culturas</span>
          <span className="text-[14px] leading-none">{emojis.join(' ')}</span>
        </div>
      )}
    </button>
  );
}
