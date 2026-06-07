import React from 'react';
import { Info } from 'lucide-react';

/**
 * PropagacaoSelector — seletor visual de método de propagação.
 *
 * Compartilhado entre o formulário de Novo Lote (anual) e o de Novo Talhão
 * (perene) para manter a mesma UX. Mostra os métodos como chips e, abaixo, a
 * descrição do método selecionado.
 *
 * @param {Array}    metodos  - cultura.metodosPropagacao [{ key, label, descricao, diasViveiro }]
 * @param {string}   selected - key do método selecionado
 * @param {Function} onChange - (key) => void
 * @param {string}   cor      - cor de destaque da cultura
 */
export default function PropagacaoSelector({ metodos, selected, onChange, cor }) {
  const selectedMetodo = metodos.find(m => m.key === selected);
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Método de propagação
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {metodos.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={selected === m.key
              ? { background: cor, color: '#fff' }
              : { background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}
          >
            {m.label}
            {m.diasViveiro > 0 && (
              <span className="ml-1 opacity-70">· {m.diasViveiro}d viveiro</span>
            )}
          </button>
        ))}
      </div>
      {selectedMetodo && (
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-[11px] text-muted-foreground"
          style={{ background: `${cor}08`, border: `1px solid ${cor}20` }}>
          <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: cor }} />
          <span>{selectedMetodo.descricao}</span>
        </div>
      )}
    </div>
  );
}
