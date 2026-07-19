import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Layers, FlaskConical, CalendarDays, Droplets, Clock } from 'lucide-react';
import LotesPage from './LotesPage';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import { loadLotes } from '../hooks/useSupabaseSync';

const TABS = [
  { value: 'lotes',      label: 'Lotes',      Icon: Layers },
  { value: 'manejo',     label: 'Manejo',      Icon: FlaskConical },
  { value: 'cronograma', label: 'Cronograma',  Icon: CalendarDays },
];

const GLASS_STATS = (c) => [
  { Icon: FlaskConical, label: 'Solo',  value: c.soloTipo },
  { Icon: Clock,        label: 'Ciclo', value: c.ciclo },
  { Icon: Droplets,     label: 'Água',  value: c.necessidadeHidrica },
];

export default function CulturaPage({ cultura, onBack, autoOpenLoteForm = false, propriedadeId = null }) {
  const [tab, setTab] = useState('lotes');
  const isCampo = cultura.tipo === 'campo';

  // ── Shared calculator state (used by LotesPage and ManejoAdubacao) ──
  const [calc, setCalc] = useState(
    isCampo
      ? { area: 1, linhas: cultura.espacamento.linhas, plantas: cultura.espacamento.plantas }
      : {
          comprimento: cultura.canteiro.comprimento,
          largura: cultura.canteiro.largura,
          linhas: cultura.canteiro.espacamentoLinhas,
          plantas: cultura.canteiro.espacamentoPlantas,
        }
  );

  // ── Shared lotes state (used by LotesPage and CronogramaTimeline) ──
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);

  useEffect(() => {
    setLoadingLotes(true);
    loadLotes(cultura.id).then(data => {
      setLotes(data);
      setLoadingLotes(false);
    });
  }, [cultura.id]);

  const handleLoteAdded = (novoLote) => setLotes(prev => [novoLote, ...prev]);
  const handleLoteDeleted = (id) => setLotes(prev => prev.filter(l => l.id !== id));

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute pointer-events-none" style={{ top: '-30%', right: '-15%', width: '55%', height: '65%', background: `radial-gradient(circle, ${cultura.cor}35 0%, transparent 70%)` }} />
        <div className="absolute pointer-events-none" style={{ bottom: '-20%', left: '-10%', width: '40%', height: '50%', background: `radial-gradient(circle, ${cultura.cor}18 0%, transparent 70%)` }} />
        <div className="absolute right-0 bottom-0 select-none pointer-events-none font-display font-black leading-none overflow-hidden"
          style={{ fontSize: 'clamp(80px, 16vw, 160px)', color: cultura.cor, opacity: 0.07, letterSpacing: '-0.06em', right: '-2%', bottom: '-10%' }}>
          {cultura.nome}
        </div>

        <div className="relative z-10 px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top-no-btns)' }}>
          <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Culturas
          </button>

          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)', fontSize: 22 }}>
                {cultura.emoji}
              </div>
              <div>
                <p className="text-white/50 text-xs italic leading-none mb-1">{cultura.nomesCientifico}</p>
                <h1 className="font-display text-white font-extrabold leading-tight" style={{ fontSize: 'clamp(20px, 5vw, 30px)' }}>
                  {cultura.nome}
                </h1>
              </div>
            </div>
            {isCampo && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0 mt-1"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}>
                campo · ha
              </span>
            )}
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.07 }}
            className="text-white/60 text-[13px] leading-relaxed mb-4 max-w-lg">
            {cultura.descricao}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}
            className="grid grid-cols-3 gap-2">
            {GLASS_STATS(cultura).map(({ Icon, label, value }) => (
              <div key={label} className="glass rounded-xl p-3" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={10} className="text-white/55" />
                  <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest">{label}</span>
                </div>
                <p className="text-white font-display text-[11px] font-bold leading-tight">{value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Sticky tab bar ── */}
      <div
        className="sticky top-0 z-20 px-4 py-2.5"
        style={{
          background: 'rgb(244, 246, 248)',
          borderBottom: '1px solid hsl(140 13% 88%)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="inline-flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'hsl(140 14% 93%)' }}>
          {TABS.map(({ value, label, Icon }) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-semibold outline-none transition-colors duration-150"
                style={{ color: isActive ? '#fff' : 'hsl(150 8% 40%)' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="cultura-tab-pill"
                    className="absolute inset-0 rounded-[10px]"
                    style={{ background: cultura.cor }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={12} />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${cultura.id}-${tab}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: 'opacity, transform' }}
        >
          {tab === 'lotes' && (
            <LotesPage
              cultura={cultura}
              calc={calc}
              onCalcChange={setCalc}
              lotes={lotes}
              loadingLotes={loadingLotes}
              onLoteAdded={handleLoteAdded}
              onLoteDeleted={handleLoteDeleted}
              autoOpenForm={autoOpenLoteForm}
              propriedadeId={propriedadeId}
            />
          )}
          {tab === 'manejo'     && <ManejoAdubacao  cultura={cultura} calc={calc} />}
          {tab === 'cronograma' && <CronogramaTimeline cultura={cultura} lotes={lotes} propriedadeId={propriedadeId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
