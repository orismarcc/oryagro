import React, { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';

/**
 * CalcNote — nota expansível "Como é calculado" para dar transparência a
 * qualquer número derivado na interface. Reutilizável em qualquer card/página.
 *
 * Uso:
 *   <CalcNote>
 *     <li>Receita = produção (kg) × preço/kg</li>
 *   </CalcNote>
 *
 * @param {string} title  - rótulo do botão (padrão "Como é calculado")
 * @param {string} cor    - cor de destaque
 * @param {ReactNode} children - conteúdo (use <li> para itens; vira <ul>)
 */
export default function CalcNote({ title = 'Como é calculado', cor = 'hsl(157 68% 26%)', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: cor }}
        aria-expanded={open}
      >
        <Info size={11} />
        {title}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <ul
          className="mt-1.5 flex flex-col gap-1 rounded-xl px-3 py-2 text-[11px] leading-snug text-muted-foreground list-disc list-inside"
          style={{ background: 'hsl(140 14% 96%)', border: '1px solid hsl(140 13% 90%)' }}
        >
          {children}
        </ul>
      )}
    </div>
  );
}
