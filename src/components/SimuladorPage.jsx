import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CULTURAS, CULTURAS_LIST } from '../data/culturas';
import SimuladorFinanceiro from './SimuladorFinanceiro';
import { TrendingUp, ChevronDown } from 'lucide-react';

export default function SimuladorPage() {
  const [culturaId, setCulturaId] = useState('alface');
  const [open, setOpen] = useState(false);
  const cultura = CULTURAS[culturaId];

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />

        <div className="absolute right-5 bottom-2 pointer-events-none select-none opacity-[0.05]">
          <TrendingUp size={100} color="white" />
        </div>

        <div className="relative z-10 px-5 pt-6 pb-6">
          <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Simulador Financeiro</p>
          <h1 className="font-display text-white text-2xl font-extrabold leading-tight mb-4">
            Calcule seu retorno
          </h1>

          {/* Culture picker */}
          <div className="relative">
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

            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden z-50"
                style={{
                  background: 'hsl(160 84% 10%)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 20px 40px -8px rgb(0 0 0 / 0.4)',
                }}
              >
                {CULTURAS_LIST.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCulturaId(c.id); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                    style={{
                      background: culturaId === c.id ? `${c.cor}20` : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span className="text-lg">{c.emoji}</span>
                    <div>
                      <p className="text-white text-[13px] font-semibold leading-none">{c.nome}</p>
                      <p className="text-white/45 text-[10px] mt-0.5 capitalize">{c.tipo}</p>
                    </div>
                    {culturaId === c.id && (
                      <div
                        className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: c.cor }}
                      />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Simulator ── */}
      <motion.div
        key={culturaId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <SimuladorFinanceiro cultura={cultura} />
      </motion.div>
    </div>
  );
}
