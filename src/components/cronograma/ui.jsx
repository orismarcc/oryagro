/**
 * cronograma/ui.jsx — componentes pequenos do CronogramaTimeline.
 * Extraídos sem alterar a marcação.
 */
import React from 'react';
import { Layers } from 'lucide-react';

// ── Toggle (switch acessível) ────────────────────────────────────────────────
export function Toggle({ enabled, onToggle, color, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      aria-label={label || 'Alternar'}
      className="relative flex-shrink-0"
      style={{ width: 40, height: 22 }}
    >
      <span className="absolute inset-0 rounded-full transition-colors"
        style={{ background: enabled ? color : 'hsl(210 16% 88%)' }} />
      <span className="absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow transition-all"
        style={{ left: enabled ? 21 : 3 }} />
    </button>
  );
}

// ── Lote picker pill ─────────────────────────────────────────────────────────
// Only shown when there are multiple lotes — never shows "Genérico" option.
export function LotePicker({ lotes, selectedId, onSelect, cor }) {
  if (lotes.length <= 1) return null;
  return (
    <div className="mb-4">
      <p className="section-label mb-2 px-1">Selecionar lote</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {lotes.map(l => (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
            style={selectedId === l.id
              ? { background: cor, color: '#fff' }
              : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 40%)' }
            }
          >
            <Layers size={10} />
            {l.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
