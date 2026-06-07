/**
 * finance/ui.jsx — primitivos visuais do FinanceiroPage.
 * Extraídos sem alterar a marcação.
 */
import React from 'react';
import { BarChart2 } from 'lucide-react';

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/60 mb-2 px-1">
      {children}
    </p>
  );
}

export function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      <p className="text-[12px] text-gray-400">Carregando dados financeiros…</p>
    </div>
  );
}

export function EmptyState({ message = 'Nenhum dado financeiro encontrado.' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <BarChart2 size={28} className="text-green-400" />
      </div>
      <p className="text-[14px] font-bold text-gray-700">{message}</p>
      <p className="text-[12px] text-gray-400 leading-relaxed">
        Registre vendas e movimentações de estoque para visualizar o demonstrativo.
      </p>
    </div>
  );
}
