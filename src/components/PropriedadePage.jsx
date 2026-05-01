import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package2, Plus, Building2, Leaf, CheckCircle2, AlertTriangle } from 'lucide-react';
import { loadLotesByPropriedade } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';

function LoteSummaryCard({ lote, onSelect }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;
  const cor = cultura.cor;
  const lc  = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita, faseAtual, faseIndex } = lc;
  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(lote)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${cor}15` }}>
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{cultura.nome}</span>
            {faseAtual && !prontoParaColheita && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: faseColor.bg, color: faseColor.text }}>
                <Leaf size={9} /> {faseAtual}
              </span>
            )}
            {prontoParaColheita && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-black" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[10px] text-muted-foreground">{prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }} />
      </div>
    </motion.button>
  );
}

export default function PropriedadePage({ propriedade, onBack, onSelectLote, onGoEstoque, onAddLote }) {
  const [lotes, setLotes]     = useState([]);
  const [alertas, setAlertas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadLotesByPropriedade(propriedade.id),
      loadEstoque(propriedade.id),
    ]).then(([ls, insumos]) => {
      setLotes(ls);
      setAlertas(insumos.filter(i => i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0).length);
      setLoading(false);
    });
  }, [propriedade.id]);

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero px-5 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Propriedades
        </button>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
              <Building2 size={22} color="white" />
            </div>
            <div>
              <h1 className="font-display text-white text-xl font-extrabold leading-tight">{propriedade.nome}</h1>
              {propriedade.descricao && <p className="text-white/55 text-[12px] mt-0.5">{propriedade.descricao}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onGoEstoque}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Package2 size={13} /> Estoque
            {alertas > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: '#dc2626', color: '#fff' }}>
                {alertas}
              </span>
            )}
          </button>
          <button onClick={onAddLote}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Plus size={13} /> Novo Lote
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="section-label">Lotes</p>
          <span className="text-[11px] text-muted-foreground">{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : lotes.length === 0 ? (
          <div className="card p-8 flex flex-col items-center gap-3 text-center">
            <Leaf size={32} className="opacity-30" />
            <p className="text-[14px] font-bold text-foreground">Nenhum lote nesta propriedade</p>
            <p className="text-[12px] text-muted-foreground">Adicione o primeiro lote clicando em "Novo Lote" acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lotes.map(lote => <LoteSummaryCard key={lote.id} lote={lote} onSelect={onSelectLote} />)}
          </div>
        )}
      </div>
    </div>
  );
}
