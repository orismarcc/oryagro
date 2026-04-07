import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS_LIST, CULTURAS } from '../data/culturas';
import { loadTodosLotes } from '../hooks/useSupabaseSync';
import { ChevronRight, Sprout, Clock, Droplets, MapPin, Plus, CalendarDays, X, CheckCircle2 } from 'lucide-react';

const TYPE_BADGE = {
  campo:    { label: 'Campo · ha',  bg: 'hsl(38 90% 93%)',  color: 'hsl(38 70% 32%)' },
  canteiro: { label: 'Canteiro',    bg: 'hsl(221 90% 95%)', color: 'hsl(221 60% 40%)' },
};

function parseCicloDias(cicloStr) {
  const match = cicloStr?.match(/\d+/g);
  return match ? parseInt(match[match.length - 1]) : 60;
}

// ── Quick "Novo Lote" picker ───────────────────────────────────────────────

function NovoLotePicker({ onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="card overflow-hidden"
      style={{ border: '1px solid hsl(214 20% 88%)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(214 20% 90%)' }}>
        <p className="text-[13px] font-bold text-foreground">Qual cultura?</p>
        <button onClick={onClose} className="text-muted-foreground p-0.5">
          <X size={16} />
        </button>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {CULTURAS_LIST.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ borderBottom: '1px solid hsl(214 20% 93%)' }}
          >
            <span className="text-xl flex-shrink-0">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-none">{c.nome}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.tipo}</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Recent lots mini-card ──────────────────────────────────────────────────

function LoteMini({ lote, onSelectCultura }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;
  const cor = cultura.cor;
  const cicloDias = parseCicloDias(cultura.ciclo);
  const diasDecorridos = Math.floor(
    (Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000
  );
  const progresso = Math.min((diasDecorridos / cicloDias) * 100, 100);
  const concluido = diasDecorridos >= cicloDias;

  return (
    <button
      onClick={() => onSelectCultura(lote.cultura_id)}
      className="card-interactive w-full p-3 flex items-center gap-3 text-left"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      <div className="flex-shrink-0 text-xl w-8 text-center">{cultura.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-foreground leading-none truncate">{lote.nome}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <CalendarDays size={9} style={{ color: cor }} />
          <span className="text-[10px] text-muted-foreground">
            {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>
        {/* progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progresso}%`, background: concluido ? '#16a34a' : cor }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {concluido ? (
          <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
        ) : (
          <span className="text-[11px] font-bold" style={{ color: cor }}>
            D{diasDecorridos}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function Dashboard({ onSelectCultura }) {
  const [showLotePicker, setShowLotePicker] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const pickerRef = useRef(null);

  useEffect(() => {
    loadTodosLotes(6).then(data => {
      setLotes(data);
      setLoadingLotes(false);
    });
  }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!showLotePicker) return;
    const handler = e => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowLotePicker(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [showLotePicker]);

  const handleNovoLote = (culturaId) => {
    setShowLotePicker(false);
    onSelectCultura(culturaId);
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero header ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.06]">
          <Sprout size={120} color="white" />
        </div>

        <div className="relative z-10 px-5 pt-6 pb-7">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center border flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}
            >
              <Sprout size={20} color="white" />
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium">Guia Hortícola</p>
              <h1 className="font-display text-white text-xl font-extrabold leading-tight">OryAgro</h1>
            </div>
          </div>

          {/* Stats row */}
          <div className="glass rounded-2xl p-4" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.15)' }}>
              <div className="pr-4">
                <p className="font-display text-white text-2xl font-black leading-none">{CULTURAS_LIST.length}</p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Culturas</p>
              </div>
              <div className="px-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {CULTURAS_LIST.filter(c => c.tipo === 'campo').length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Campo</p>
              </div>
              <div className="pl-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {loadingLotes ? '…' : lotes.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Lotes</p>
              </div>
            </div>
          </div>

          {/* Novo Lote CTA */}
          <div className="mt-3" ref={pickerRef}>
            <button
              onClick={() => setShowLotePicker(o => !o)}
              className="glass w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <Plus size={15} color="white" />
              <span className="text-white text-[13px] font-semibold">Novo Lote</span>
            </button>

            <AnimatePresence>
              {showLotePicker && (
                <div className="mt-2">
                  <NovoLotePicker onSelect={handleNovoLote} onClose={() => setShowLotePicker(false)} />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Recent lots ── */}
      {!loadingLotes && lotes.length > 0 && (
        <div className="px-4 pt-5 pb-1">
          <p className="section-label mb-3 px-1">Lotes Recentes</p>
          <div className="space-y-2">
            {lotes.map((lote, i) => (
              <motion.div
                key={lote.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <LoteMini lote={lote} onSelectCultura={onSelectCultura} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Culture list ── */}
      <div className="px-4 pt-5 pb-4">
        <p className="section-label mb-3 px-1">Selecione uma cultura</p>

        <div className="space-y-3">
          {CULTURAS_LIST.map((c, i) => {
            const badge = TYPE_BADGE[c.tipo] || TYPE_BADGE.canteiro;
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelectCultura(c.id)}
                className="card-interactive w-full text-left p-4 flex items-center gap-4"
              >
                <div
                  className="icon-circle w-14 h-14 text-2xl flex-shrink-0 rounded-2xl"
                  style={{ background: `${c.cor}15` }}
                >
                  {c.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-display text-[15px] font-bold text-foreground">{c.nome}</span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground italic mb-2 leading-none">{c.nomesCientifico}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock size={10} style={{ color: c.cor }} />
                      {c.ciclo}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Droplets size={10} style={{ color: c.cor }} />
                      {c.necessidadeHidrica}
                    </span>
                    {c.tipo === 'campo' && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin size={10} style={{ color: c.cor }} />
                        {c.areaPadrao}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
