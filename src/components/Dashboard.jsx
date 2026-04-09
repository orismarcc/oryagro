import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes } from '../hooks/useSupabaseSync';
import { Plus, CalendarDays, Sprout, CheckCircle2, LogOut, Layers } from 'lucide-react';

function parseCicloDias(cicloStr) {
  const match = cicloStr?.match(/\d+/g);
  return match ? parseInt(match[match.length - 1]) : 60;
}

// ── Lot card ─────────────────────────────────────────────────────────────────

function LoteCard({ lote, onSelect, index }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;

  const cor = cultura.cor;
  const cicloDias = parseCicloDias(cultura.ciclo);
  const diasDecorridos = Math.max(0, Math.floor(
    (Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000
  ));
  const progresso = Math.min((diasDecorridos / cicloDias) * 100, 100);
  const concluido = diasDecorridos >= cicloDias;
  const diasRestantes = Math.max(cicloDias - diasDecorridos, 0);
  const isCampo = cultura.tipo === 'campo';

  const dimensao = isCampo
    ? `${lote.area_ha ?? '?'} ha`
    : lote.comprimento_m && lote.largura_m
      ? `${lote.comprimento_m}×${lote.largura_m} m`
      : '—';

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
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${cor}15` }}
        >
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
            {concluido && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
            {concluido ? 'pronto' : `${diasRestantes}d`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-[11px] text-muted-foreground">
          {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
        </span>
        <span className="text-[10px] text-muted-foreground opacity-50">·</span>
        <span className="text-[11px] font-bold" style={{ color: concluido ? '#16a34a' : cor }}>
          {Math.round(progresso)}% do ciclo
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: concluido ? '#16a34a' : cor }}
        />
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

export default function Dashboard({ onAddLote, onSelectLote, onSignOut, userName }) {
  const [lotes, setLotes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    loadTodosLotes(50).then(data => {
      setLotes(data);
      setLoading(false);
    });
  }, [refreshKey]);

  // Group active vs ready-for-harvest
  const ativos    = lotes.filter(l => {
    const cultura = CULTURAS[l.cultura_id];
    if (!cultura) return false;
    const dias = Math.max(0, Math.floor((Date.now() - new Date(l.data_plantio + 'T12:00:00')) / 86_400_000));
    return dias < parseCicloDias(cultura.ciclo);
  });
  const prontos   = lotes.filter(l => {
    const cultura = CULTURAS[l.cultura_id];
    if (!cultura) return false;
    const dias = Math.max(0, Math.floor((Date.now() - new Date(l.data_plantio + 'T12:00:00')) / 86_400_000));
    return dias >= parseCicloDias(cultura.ciclo);
  });

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
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
                <Sprout size={18} color="white" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium">
                  {userName ? `Olá, ${userName.split('@')[0]}` : 'Guia Hortícola'}
                </p>
                <h1 className="font-display text-white text-xl font-extrabold leading-tight">OryAgro</h1>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors p-1.5"
            >
              <LogOut size={15} />
            </button>
          </div>

          {/* Stats glass */}
          <div className="glass rounded-2xl p-4 mb-3" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.15)' }}>
              <div className="pr-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {loading ? '…' : lotes.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Lotes</p>
              </div>
              <div className="px-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {loading ? '…' : ativos.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Ativos</p>
              </div>
              <div className="pl-4">
                <p className="font-display text-white text-2xl font-black leading-none text-emerald-300">
                  {loading ? '…' : prontos.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">P/ Colheita</p>
              </div>
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={onAddLote}
            className="glass w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}
          >
            <Plus size={15} color="white" />
            <span className="text-white text-[13px] font-bold">Novo Lote</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'hsl(160 84% 27% / 0.4)', borderTopColor: 'hsl(160 84% 27%)' }}
            />
            Carregando lotes…
          </div>
        ) : lotes.length === 0 ? (
          <EmptyLotes onAdd={onAddLote} />
        ) : (
          <>
            {/* Ready for harvest */}
            <AnimatePresence>
              {prontos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mb-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="section-label" style={{ color: '#16a34a' }}>
                      Prontos para colheita ({prontos.length})
                    </p>
                  </div>
                  <div className="space-y-3">
                    {prontos.map((l, i) => (
                      <LoteCard key={l.id} lote={l} onSelect={onSelectLote} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active lots */}
            {ativos.length > 0 && (
              <div>
                <p className="section-label mb-3 px-1">
                  Lotes ativos ({ativos.length})
                </p>
                <div className="space-y-3">
                  {ativos.map((l, i) => (
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
