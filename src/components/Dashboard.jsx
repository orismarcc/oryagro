import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes, loadPropriedades } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { resolveLifecycle, fmtDateBR, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';
import { Plus, CalendarDays, Sprout, CheckCircle2, LogOut, Layers, AlertCircle, Clock, ArrowRight, Leaf, Building2, ChevronRight, AlertTriangle } from 'lucide-react';

function getStatusEtapas(cultura, lote) {
  if (!cultura?.cronograma) return { atrasadas: 0, hoje: null, amanha: null, proxima: null };
  try {
    const diasDecorridos = Math.max(
      0, Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000)
    );
    const doneStatus = JSON.parse(localStorage.getItem(`cronograma_status_lote_${lote.id}`)) || {};
    // Resolve viveiro shift from method (mirrors CronogramaTimeline logic)
    const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
      ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
      : null;
    const shift = metodoObj?.diasViveiro
      ?? (localStorage.getItem(`lote_mudas_${lote.id}`) === '1' ? 15 : 0);

    // viveiro steps (index offset)
    const viveiroCount = metodoObj?.etapasViveiro?.length ?? 0;

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

// ── Lot card ─────────────────────────────────────────────────────────────────

function LoteCard({ lote, onSelect, index }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;

  const cor = cultura.cor;
  const lc  = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita,
          faseAtual, faseIndex, dataPrimeiraProducao } = lc;

  const isCampo = cultura.tipo === 'campo';
  const dimensao = isCampo
    ? `${lote.area_ha ?? '?'} ha`
    : lote.comprimento_m && lote.largura_m
      ? `${lote.comprimento_m}×${lote.largura_m} m`
      : '—';

  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(lote)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${cor}15` }}>
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
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={9} style={{ color: cor }} />
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right ml-1">
          <p className="text-[13px] font-black leading-none" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground">
          {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
        </span>
        <span className="text-[10px] text-muted-foreground opacity-50">·</span>
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
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }}
        />
      </div>

      {/* ── Próxima etapa / alertas ── */}
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

// ── PropriedadeCard ───────────────────────────────────────────────────────────

function PropriedadeCard({ propriedade, lotes, alertasCount, onSelect, index }) {
  const lotesDaProp = lotes.filter(l => l.propriedade_id === propriedade.id);
  const ativos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && !resolveLifecycle(l, c).prontoParaColheita;
  });
  const prontos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && resolveLifecycle(l, c).prontoParaColheita;
  });

  let diasParaMaisUrgente = Infinity;
  ativos.forEach(l => {
    const c = CULTURAS[l.cultura_id];
    if (c) {
      const { diasParaColheita } = resolveLifecycle(l, c);
      if (diasParaColheita < diasParaMaisUrgente) diasParaMaisUrgente = diasParaColheita;
    }
  });

  // Derived info from lotes
  const areaTotal = lotesDaProp.reduce((s, l) => s + (parseFloat(l.area_ha) || 0), 0);
  const culturaIds = [...new Set(lotesDaProp.map(l => l.cultura_id).filter(Boolean))];
  const culturasNomes = culturaIds.map(id => CULTURAS[id]).filter(Boolean).map(c => `${c.emoji} ${c.nome}`);
  const dataCadastro = propriedade.created_at
    ? new Date(propriedade.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(propriedade)}
      className="card-interactive w-full text-left p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(160 84% 27% / 0.1)' }}>
          <Building2 size={18} style={{ color: 'hsl(160 84% 27%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{propriedade.nome}</p>
            {alertasCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={9} /> {alertasCount}
              </span>
            )}
          </div>
          {propriedade.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{propriedade.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{lotesDaProp.length} lote{lotesDaProp.length !== 1 ? 's' : ''}</span>
            {ativos.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</span>
            )}
            {prontos.length > 0 && (
              <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>
                {prontos.length} pronto{prontos.length !== 1 ? 's' : ''} p/ colheita
              </span>
            )}
            {diasParaMaisUrgente < Infinity && (
              <span className="text-[11px] text-muted-foreground">
                próx. colheita: {fmtDiasRestantes(diasParaMaisUrgente)}
              </span>
            )}
          </div>

          {/* Property info grid */}
          {lotesDaProp.length > 0 && (
            <div className="mt-2 pt-2 flex flex-wrap gap-x-3 gap-y-1"
              style={{ borderTop: '1px solid hsl(214 20% 93%)' }}>
              {areaTotal > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span style={{ color: 'hsl(160 84% 27%)' }}>⬛</span>
                  {areaTotal.toFixed(1)} ha cultivados
                </span>
              )}
              {culturasNomes.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {culturasNomes.slice(0, 2).join(', ')}{culturasNomes.length > 2 ? ` +${culturasNomes.length - 2}` : ''}
                </span>
              )}
              {dataCadastro && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarDays size={9} style={{ color: 'hsl(160 84% 27%)' }} />
                  Desde {dataCadastro}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={16} className="opacity-30 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyLotes({ onAdd }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="card p-8 flex flex-col items-center gap-3 text-center"
    >
      <div className="icon-circle w-16 h-16 text-3xl"
        style={{ background: 'hsl(160 84% 27% / 0.1)' }}>
        <Layers size={24} style={{ color: 'hsl(160 84% 27%)' }} />
      </div>
      <div>
        <p className="text-[14px] font-bold text-foreground">Nenhum lote cadastrado</p>
        <p className="text-[12px] text-muted-foreground mt-1">
          Comece registrando seu primeiro lote de plantio
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-[0.98]"
        style={{ background: 'hsl(160 84% 27%)' }}
      >
        <Plus size={15} /> Novo Lote
      </button>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({ onAddLote, onSelectLote, onSelectPropriedade, onManagePropriedades, onSignOut, userName }) {
  const [lotes, setLotes]                   = useState([]);
  const [propriedades, setPropriedades]     = useState([]);
  const [alertasPorProp, setAlertasPorProp] = useState({});
  const [loading, setLoading]               = useState(true);
  const [refreshKey, setRefreshKey]         = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadTodosLotes(100),
      loadPropriedades(),
      loadEstoque(),
    ]).then(([ls, props, insumos]) => {
      setLotes(ls);
      setPropriedades(props);
      const alerts = {};
      insumos.forEach(i => {
        if (i.propriedade_id && i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0) {
          alerts[i.propriedade_id] = (alerts[i.propriedade_id] || 0) + 1;
        }
      });
      setAlertasPorProp(alerts);
      setLoading(false);
    });
  }, [refreshKey]);

  const lotesOrfaos = lotes.filter(l => !l.propriedade_id);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.06]">
          <Sprout size={120} color="white" />
        </div>

        <div className="relative z-10 px-5 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
                <Sprout size={18} color="white" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium">
                  {userName ? `Olá, ${userName}` : 'Guia Hortícola'}
                </p>
                <h1 className="font-display text-white text-xl font-extrabold leading-tight">OryAgro</h1>
              </div>
            </div>
            <button onClick={onSignOut} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors p-1.5">
              <LogOut size={15} />
            </button>
          </div>

          {/* Stats */}
          <div className="glass rounded-2xl p-4 mb-3" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.15)' }}>
              <div className="pr-4">
                <p className="font-display text-white text-2xl font-black leading-none">{loading ? '…' : propriedades.length}</p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Propriedades</p>
              </div>
              <div className="px-4">
                <p className="font-display text-white text-2xl font-black leading-none">{loading ? '…' : lotes.length}</p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Lotes</p>
              </div>
              <div className="pl-4">
                <p className="font-display text-white text-2xl font-black leading-none text-emerald-300">
                  {loading ? '…' : lotes.filter(l => {
                    const c = CULTURAS[l.cultura_id];
                    return c && resolveLifecycle(l, c).prontoParaColheita;
                  }).length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">P/ Colheita</p>
              </div>
            </div>
          </div>

          {/* Manage properties */}
          <button onClick={onManagePropriedades}
            className="glass w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}>
            <Building2 size={15} color="white" />
            <span className="text-white text-[13px] font-bold">Gerenciar Propriedades</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'hsl(160 84% 27% / 0.4)', borderTopColor: 'hsl(160 84% 27%)' }} />
            Carregando…
          </div>
        ) : propriedades.length === 0 && lotes.length === 0 ? (
          <EmptyLotes onAdd={onManagePropriedades} />
        ) : (
          <>
            {propriedades.length > 0 && (
              <div className="mb-5">
                <p className="section-label mb-3 px-1">Suas propriedades</p>
                <div className="space-y-3">
                  {propriedades.map((p, i) => (
                    <PropriedadeCard key={p.id} propriedade={p} lotes={lotes} alertasCount={alertasPorProp[p.id] || 0} onSelect={onSelectPropriedade} index={i} />
                  ))}
                </div>
              </div>
            )}

            {lotesOrfaos.length > 0 && (
              <div>
                <p className="section-label mb-3 px-1 text-muted-foreground">Sem propriedade ({lotesOrfaos.length})</p>
                <div className="space-y-3">
                  {lotesOrfaos.map((l, i) => (
                    <LoteCard key={l.id} lote={l} onSelect={onSelectLote} index={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
