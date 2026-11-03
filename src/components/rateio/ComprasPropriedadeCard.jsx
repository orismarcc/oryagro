/**
 * ComprasPropriedadeCard — gastos lançados na PROPRIEDADE e para quais lotes
 * foram. Botão para lançar uma nova compra (CompraPropriedadeSheet).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { loadComprasPropriedade, loadComprovantes } from '../../hooks/useRateio';
import { CULTURAS } from '../../data/culturas';
import CompraPropriedadeSheet from './CompraPropriedadeSheet';
import DespesaExtras from './DespesaExtras';

const BRAND = 'hsl(156 64% 31%)';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQ = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtData = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${y}` : '—'; };

export default function ComprasPropriedadeCard({ propriedade, lotes = [], podeLancar = true }) {
  const [compras, setCompras] = useState([]);
  const [anexos, setAnexos] = useState({});
  const [aberto, setAberto] = useState(false);
  const [todas, setTodas] = useState(false);

  const carregar = useCallback(async () => {
    const cs = await loadComprasPropriedade(propriedade.id);
    setCompras(cs);
    setAnexos(await loadComprovantes(cs.map(c => c.id)));
  }, [propriedade.id]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const cs = await loadComprasPropriedade(propriedade.id);
      const an = await loadComprovantes(cs.map(c => c.id));
      if (!cancel) { setCompras(cs); setAnexos(an); }
    })();
    return () => { cancel = true; };
  }, [propriedade.id]);

  const lotePorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  const nomeLote = (id) => {
    const l = lotePorId[id];
    const c = CULTURAS[l?.cultura_id];
    return `${c?.emoji || '🌱'} ${l?.nome || c?.nome || 'Lote'}`;
  };
  const visiveis = todas ? compras : compras.slice(0, 4);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <p className="section-label">Compras da propriedade</p>
        {podeLancar && (
          <button onClick={() => setAberto(true)} className="flex items-center gap-1 text-[12px] font-bold" style={{ color: BRAND }}>
            <Plus size={14} /> Lançar compra
          </button>
        )}
      </div>
      {compras.length === 0 ? (
        <button onClick={() => podeLancar && setAberto(true)} className="card w-full p-4 flex items-center gap-3 text-left">
          <ShoppingCart size={18} style={{ color: BRAND }} />
          <p className="text-[12.5px] text-muted-foreground">
            Comprou algo para a fazenda (calcário, adubo, serviço)? Lance aqui uma vez e distribua entre os lotes.
          </p>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map(c => (
            <div key={c.id} className="card p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13.5px] font-bold truncate">{c.produto || c.descricao || c.subcategoria || c.categoria}</p>
                <p className="text-[14px] font-extrabold flex-shrink-0" style={{ color: BRAND }}>{fmtBRL(c.valor)}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {fmtData(c.data)}{c.quantidade != null ? ` · ${fmtQ(c.quantidade)} ${c.unidade || ''}` : ''}
              </p>
              {c.destinos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.destinos.map(d => (
                    <span key={d.id} className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'hsl(156 40% 94%)', color: BRAND }}>
                      {nomeLote(d.plantio_id)}: {d.quantidade != null ? `${fmtQ(d.quantidade)} ${d.unidade || ''} · ` : ''}{fmtBRL(d.valor)}
                    </span>
                  ))}
                </div>
              )}
              <DespesaExtras despesa={c} anexos={anexos[c.id]} cor={BRAND} onMudou={carregar} podeEditar={podeLancar} />
            </div>
          ))}
          {compras.length > 4 && (
            <button onClick={() => setTodas(t => !t)} className="text-[12px] font-bold py-1" style={{ color: BRAND }}>
              {todas ? 'Mostrar menos' : `Ver todas (${compras.length})`}
            </button>
          )}
        </div>
      )}
      {aberto && <CompraPropriedadeSheet propriedade={propriedade} onClose={() => setAberto(false)} onSaved={carregar} />}
    </div>
  );
}
