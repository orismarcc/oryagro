import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, Sprout } from 'lucide-react';
import { CULTURAS_LIST } from '../data/culturas';

export default function Sidebar({ culturaSelecionada, onSelectCultura, onSelectComparacao }) {
  return (
    <aside className="sidebar grain relative w-[260px] min-h-screen flex flex-col flex-shrink-0">

      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Sprout size={16} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] tracking-tight leading-none">OryAgro</div>
            <div className="text-white/25 text-[10px] tracking-widest uppercase mt-0.5">Guia Hortícola</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto pb-4">
        <div className="text-white/20 text-[9px] tracking-[2.5px] uppercase font-semibold px-3 mb-2">
          Culturas
        </div>

        <div className="space-y-0.5">
          {CULTURAS_LIST.map((c) => {
            const isActive = culturaSelecionada === c.id;
            return (
              <motion.button
                key={c.id}
                onClick={() => onSelectCultura(c.id)}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group overflow-hidden"
              >
                {/* Active background */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: `${c.cor}18`, border: `1px solid ${c.cor}25` }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </AnimatePresence>

                {/* Left color bar */}
                <motion.div
                  className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
                  style={{ background: c.cor }}
                  animate={{ opacity: isActive ? 1 : 0, scaleY: isActive ? 1 : 0.3 }}
                  transition={{ duration: 0.2 }}
                />

                {/* Emoji icon */}
                <div
                  className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center text-[17px] flex-shrink-0"
                  style={{ background: `${c.cor}20` }}
                >
                  {c.emoji || '🌱'}
                </div>

                {/* Text */}
                <div className="relative z-10 flex-1 min-w-0">
                  <div
                    className="text-[13px] font-semibold leading-none transition-colors duration-150"
                    style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}
                  >
                    {c.nome}
                  </div>
                  <div className="text-[10px] text-white/20 mt-0.5 truncate">{c.ciclo}</div>
                </div>

                {/* HA badge */}
                {c.tipo === 'campo' && (
                  <span
                    className="relative z-10 text-[8px] px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0"
                    style={{ background: `${c.cor}25`, color: c.cor }}
                  >
                    HA
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/6 mx-3 my-4" />

        {/* Comparar */}
        <div className="text-white/20 text-[9px] tracking-[2.5px] uppercase font-semibold px-3 mb-2">
          Análise
        </div>
        <motion.button
          onClick={onSelectComparacao}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left overflow-hidden"
        >
          <AnimatePresence>
            {culturaSelecionada === '__comparacao__' && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
            <BarChart2 size={15} className="text-emerald-400" />
          </div>
          <span
            className="relative z-10 text-[13px] font-semibold transition-colors duration-150"
            style={{ color: culturaSelecionada === '__comparacao__' ? '#fff' : 'rgba(255,255,255,0.5)' }}
          >
            Comparar Culturas
          </span>
        </motion.button>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px #34d399' }} />
          <span className="text-[10px] text-white/20">Ory Agro © 2025</span>
        </div>
      </div>
    </aside>
  );
}
