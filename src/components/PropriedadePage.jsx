import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package2, Plus, Building2, Leaf, CheckCircle2, AlertTriangle, CalendarDays, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { loadLotesByPropriedade } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';

function getStatusEtapas(cultura, lote) {
  if (!cultura?.cronograma) return { atrasadas: 0, hoje: null, amanha: null, proxima: null };
  try {
    const diasDecorridos = Math.max(
      0, Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000)
    );
    const doneStatus = JSON.parse(localStorage.getItem(`cronograma_status_lote_${lote.id}`)) || {};
    const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
      ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
      : null;
    const shift = metodoObj?.diasViveiro
      ?? (localStorage.getItem(`lote_mudas_${lote.id}`) === '1' ? 15 : 0);

    const steps = [
      ...(metodoObj?.etapasViveiro?.map((e, i) => ({
        ...e, _id: `viveiro_${i}`,
        done: doneStatus[`viveiro_${i}`]?.status === 'feito',
      })) ?? []),
      ...cultura.cronograma.map((e, i) => ({
        ...e,
        dia: e.dia + shift,
        _id: `default_${i}`,
        done: doneStatus[`default_${i}`]?.status === 'feito',
      })),
    ];
    const pending = steps.filter(s => !s.done);
    const atrasadas = pending.filter(s => s.dia < diasDecorridos).length;
    const hoje   = pending.find(s => s.dia === diasDecorridos) || null;
    const amanha = pending.find(s => s.dia === diasDecorridos + 1) || null;
    const proxima = pending.find(s => s.dia > diasDecorridos + 1) || null;
    return { atrasadas, hoje, amanha, proxima };
  } catch { return { atrasadas: 0, hoje: null, amanha: null, proxima: null }; }
}

function LoteSummaryCard({ lote, onSelect, index }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;
  const cor = cultura.cor;
  const lc  = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita, faseAtual, faseIndex } = lc;
  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  const isCampo = cultura.tipo === 'campo';
  const dimensao = isCampo
    ? `${lote.area_ha ?? '?'} ha`
    : lote.comprimento_m && lote.largura_m
      ? `${lote.comprimento_m}×${lote.largura_m} m`
      : '—';

  // Planting method label
  const metodoLabel = lote.metodo_propagacao && cultura.metodosPropagacao
    ? (cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao)?.label ?? null)
    : null;

  // Schedule status badge
  const scheduleStatus = (() => {
    if (diasDecorridos <= 0) return { label: 'Futuro', bg: '#dbeafe', color: '#2563eb' };
    const { atrasadas } = getStatusEtapas(cultura, lote);
    if (atrasadas > 0) return { label: `${atrasadas} pendente${atrasadas > 1 ? 's' : ''}`, bg: '#fee2e2', color: '#dc2626' };
    return { label: 'Em dia', bg: '#dcfce7', color: '#16a34a' };
  })();

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(lote)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${cor}15` }}>
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
            {prontoParaColheita ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            ) : faseAtual && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: faseColor.bg, color: faseColor.text }}>
                <Leaf size={9} /> {faseAtual}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium">{cultura.nome}</span>
            <span className="text-[11px] text-muted-foreground">{dimensao}</span>
            {metodoLabel && (
              <span className="text-[11px] text-muted-foreground">{metodoLabel}</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={9} style={{ color: cor }} />
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right ml-1 flex flex-col items-end gap-1">
          <p className="text-[13px] font-black leading-none" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[9px] text-muted-foreground">
            {prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}
          </p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: scheduleStatus.bg, color: scheduleStatus.color }}>
            {scheduleStatus.label}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        {lote.total_plantas > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">
              {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
            </span>
            <span className="text-[10px] text-muted-foreground opacity-50">·</span>
          </>
        )}
        <span className="text-[11px] font-bold" style={{ color: prontoParaColheita ? '#16a34a' : cor }}>
          {progresso}% até 1ª colheita
        </span>
        {!prontoParaColheita && (
          <>
            <span className="text-[10px] text-muted-foreground opacity-50">·</span>
            <span className="text-[11px] text-muted-foreground">
              {fmtDiasRestantes(diasParaColheita)}
            </span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }} />
      </div>

      {/* Next step / alerts */}
      {!prontoParaColheita && (() => {
        const { atrasadas, hoje, amanha, proxima } = getStatusEtapas(cultura, lote);
        if (!atrasadas && !hoje && !amanha && !proxima) return null;
        return (
          <div className="mt-2.5 pt-2.5 flex flex-wrap gap-1.5"
            style={{ borderTop: '1px solid hsl(214 20% 92%)' }}>
            {atrasadas > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertCircle size={9} /> {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
              </span>
            )}
            {hoje && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fff7ed', color: '#ea580c' }}>
                <Clock size={9} /> Hoje: {hoje.etapa}
              </span>
            )}
            {amanha && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dbeafe', color: '#2563eb' }}>
                ↗ Amanhã: {amanha.etapa}
              </span>
            )}
            {!hoje && !amanha && proxima && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                <ArrowRight size={9} /> {proxima.etapa} · D{proxima.dia}
              </span>
            )}
          </div>
        );
      })()}
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
            {lotes.map((lote, i) => <LoteSummaryCard key={lote.id} lote={lote} onSelect={onSelectLote} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
