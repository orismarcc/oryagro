import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { CULTURAS, CULTURAS_LIST } from '../data/culturas';
import SimuladorFinanceiro from './SimuladorFinanceiro';
import { TrendingUp, ChevronDown } from 'lucide-react';

export default function SimuladorPage() {
  const [culturaId, setCulturaId] = useState('alface');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const cultura = CULTURAS[culturaId];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="gradient-hero relative">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute right-5 bottom-2 pointer-events-none select-none opacity-[0.05]">
          <TrendingUp size={100} color="white" />
        </div>

        <div className="relative px-5 pb-6" style={{ zIndex: 10, paddingTop: 'var(--hero-pad-top)' }}>
          <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Simulador Financeiro</p>
          <h1 className="font-display text-white text-2xl font-extrabold leading-tight mb-4">
            Calcule seu retorno
          </h1>

          {/* Culture picker */}
          <div ref={pickerRef} style={{ position: 'relative', zIndex: 9999 }}>
            <button
              onClick={() => setOpen(o => !o)}
              className="glass w-full flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cultura.emoji}</span>
                <div className="text-left">
                  <p className="text-white font-bold text-[14px] leading-none">{cultura.nome}</p>
                  <p className="text-white/55 text-[10px] mt-0.5 capitalize">{cultura.tipo}</p>
                </div>
              </div>
              <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} color="rgba(255,255,255,0.7)" />
              </motion.div>
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: 8,
                    borderRadius: 16,
                    overflow: 'hidden',
                    zIndex: 9999,
                    background: 'hsl(160 84% 10%)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 24px 48px -8px rgb(0 0 0 / 0.5)',
                  }}
                >
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {CULTURAS_LIST.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCulturaId(c.id); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                        style={{
                          background: culturaId === c.id ? `${c.cor}25` : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span className="text-lg">{c.emoji}</span>
                        <div className="flex-1">
                          <p className="text-white text-[13px] font-semibold leading-none">{c.nome}</p>
                          <p className="text-white/45 text-[10px] mt-0.5 capitalize">{c.tipo}</p>
                        </div>
                        {culturaId === c.id && (
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.cor }} />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Simulator ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={culturaId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <SimuladorFinanceiro cultura={cultura} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
