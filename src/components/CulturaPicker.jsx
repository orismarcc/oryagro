import React from 'react';
import { motion } from 'framer-motion';
import { CULTURAS_LIST } from '../data/culturas';
import { ChevronLeft, ChevronRight, Clock, Droplets, MapPin, Sprout } from 'lucide-react';

const TYPE_BADGE = {
  campo:    { label: 'Campo · ha',  bg: 'hsl(38 90% 93%)',  color: 'hsl(38 70% 32%)' },
  canteiro: { label: 'Canteiro',    bg: 'hsl(221 90% 95%)', color: 'hsl(221 60% 40%)' },
};

export default function CulturaPicker({ onSelectCultura, onBack }) {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.06]">
          <Sprout size={110} color="white" />
        </div>

        <div className="relative z-10 px-5 pt-5 pb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Meus Lotes
          </button>

          <h1 className="font-display text-white text-2xl font-extrabold leading-tight">
            Qual cultura?
          </h1>
          <p className="text-white/55 text-[13px] mt-1">
            Selecione a cultura para registrar o novo lote
          </p>
        </div>
      </div>

      {/* ── Culture list ── */}
      <div className="px-4 pt-5 pb-4 space-y-3 max-w-2xl mx-auto">
        <p className="section-label mb-3 px-1">Selecione a cultura</p>

        {CULTURAS_LIST.map((c, i) => {
          const badge = TYPE_BADGE[c.tipo] || TYPE_BADGE.canteiro;
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
  );
}
