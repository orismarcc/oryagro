import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, TrendingUp, BarChart2, Award } from 'lucide-react';
import { loadDreRawData } from '../hooks/useFinanceiro';
import { loadMaoObraBatch } from '../hooks/useGestao';
import { logDbError } from '../lib/logger';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import TabDRE from './finance/TabDRE';
import TabComparativo from './finance/TabComparativo';
import TabRanking from './finance/TabRanking';

/* ─── Navegação de abas ───────────────────────────────────────── */

const TABS = [
  { key: 'dre', label: 'DRE', icon: TrendingUp },
  { key: 'comparativo', label: 'Comparativo', icon: BarChart2 },
  { key: 'ranking', label: 'Ranking', icon: Award },
];

/* ─── Componente principal ────────────────────────────────────── */

export default function FinanceiroPage({ onBack, propriedades = [] }) {
  const [tab, setTab] = useState('dre');
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    loadDreRawData()
      .then(async (data) => {
        const plantioIds = (data.plantios || []).map(p => p.id);
        const maoObraMap = await loadMaoObraBatch(plantioIds).catch(() => ({}));
        setRawData({ ...data, maoObraMap });
        setLoading(false);
      })
      .catch(err => { logDbError('FinanceiroPage.load', err); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: re-fetch DRE whenever vendas or despesas change (any device/user)
  useRealtimeSync('vendas',   fetchData);
  useRealtimeSync('despesas', fetchData);
  useRealtimeSync('receitas', fetchData);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="gradient-hero text-white px-4 pb-4 flex flex-col gap-4" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        {/* Linha superior — pr-24 reserva espaço para os botões flutuantes (≡ e 🔔) */}
        <div className="flex items-center gap-3 pr-24">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-[12px] font-semibold">Voltar</span>
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <BarChart2 size={18} className="opacity-80" />
            <h1 className="text-[16px] font-bold leading-tight">Financeiro</h1>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-green-800/40 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-[11px] font-bold"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.9)', color: 'hsl(157 68% 26%)' }
                    : { color: 'rgba(255,255,255,0.65)' }
                }
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'dre' && (
              <TabDRE rawData={rawData} loading={loading} propriedades={propriedades} />
            )}
            {tab === 'comparativo' && (
              <TabComparativo rawData={rawData} loading={loading} propriedades={propriedades} />
            )}
            {tab === 'ranking' && (
              <TabRanking rawData={rawData} loading={loading} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
