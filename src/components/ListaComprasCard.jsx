/**
 * ListaComprasCard.jsx — Lista de Compras Inteligente do estoque.
 *
 * Soma o que o PRODUTOR AGENDOU no cronograma dos lotes ativos da propriedade
 * (produto + quantidade + data prevista) e subtrai o estoque atual. Só mostra
 * o que realmente falta. O sistema não prevê aplicações: se nada foi agendado,
 * não há nada a comprar. Agendamento sem quantidade vira "a confirmar".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Loader2, HelpCircle, PackageCheck } from 'lucide-react';
import { loadTodosLotes } from '../hooks/useSupabaseSync';
import { loadAtividadesPorLotes } from '../hooks/useAtividades';
import { computeListaCompras } from '../lib/listaCompras';

const HORIZONTES = [30, 60, 90];

function fmtQtd(v) {
  return (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ListaComprasCard({ propriedadeId, insumos = [] }) {
  const [lotes, setLotes] = useState(null); // null = carregando
  const [atividades, setAtividades] = useState([]);
  const [horizonte, setHorizonte] = useState(30);

  useEffect(() => {
    let cancel = false;
    loadTodosLotes(300)
      .then(async all => {
        if (cancel) return;
        const ativos = all.filter(l =>
          (l.status ? l.status === 'ativo' : true) &&
          (propriedadeId ? String(l.propriedade_id) === String(propriedadeId) : true)
        );
        setLotes(ativos);
        // Agendamentos desses lotes — a única fonte da necessidade de compra.
        const rows = await loadAtividadesPorLotes(ativos.map(l => l.id));
        if (!cancel) setAtividades(rows);
      })
      .catch(() => !cancel && setLotes([]));
    return () => { cancel = true; };
  }, [propriedadeId]);

  const { itens, incertos } = useMemo(() => {
    if (!lotes) return { itens: [], incertos: [] };
    return computeListaCompras({ lotes, atividades, estoque: insumos, horizonteDias: horizonte });
  }, [lotes, atividades, insumos, horizonte]);

  const carregando = lotes === null;
  const temLotes = (lotes?.length ?? 0) > 0;
  const nada = !carregando && itens.length === 0 && incertos.length === 0;

  // Não renderiza se não há lotes ativos (nada a planejar)
  if (!carregando && !temLotes) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(156 64% 31% / 0.14)' }}>
          <ShoppingCart size={15} style={{ color: 'hsl(156 64% 31%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight">Lista de compras inteligente</p>
          <p className="text-[10.5px] text-muted-foreground">Do que você agendou nos lotes · próximos {horizonte} dias</p>
        </div>
      </div>

      {/* Seletor de horizonte */}
      <div className="flex gap-1.5 mt-2 mb-3">
        {HORIZONTES.map(h => (
          <button key={h} onClick={() => setHorizonte(h)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
            style={horizonte === h
              ? { background: 'hsl(156 64% 31%)', color: 'white' }
              : { background: 'hsl(156 30% 92%)', color: 'hsl(156 40% 30%)' }}>
            {h}d
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'hsl(156 64% 31%)' }} /></div>
      ) : nada ? (
        <div className="flex items-center gap-2 py-3 px-1">
          <PackageCheck size={16} style={{ color: 'hsl(156 64% 31%)' }} />
          <p className="text-[11.5px] text-muted-foreground">
            Nada a comprar: o estoque cobre o que está agendado neste período
            (ou ainda não há agendamentos).
          </p>
        </div>
      ) : (
        <>
          {/* Itens a comprar */}
          {itens.length > 0 && (
            <div className="space-y-2">
              {itens.map((it) => (
                <div key={`${it.produto}-${it.unidade}`} className="rounded-xl border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-foreground truncate">{it.produto}</span>
                    <span className="text-[13px] font-black flex-shrink-0" style={{ color: 'hsl(156 64% 31%)' }}>
                      {fmtQtd(it.comprar)} {it.unidade}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                    <span>Necessário: <strong className="text-foreground/80">{fmtQtd(it.necessario)} {it.unidade}</strong></span>
                    {it.temNoEstoque && !it.unidadeConflito && (
                      <span>· Em estoque: {fmtQtd(it.emEstoque)} {it.unidade}</span>
                    )}
                    {!it.temNoEstoque && <span className="text-amber-600 font-semibold">· não cadastrado no estoque</span>}
                    {it.unidadeConflito && (
                      <span className="text-amber-600 font-semibold">· unidade do estoque ({it.unidadeEstoque}) difere</span>
                    )}
                  </div>
                  <p className="text-[9.5px] text-muted-foreground/80 mt-0.5 truncate">
                    Para: {it.lotes.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* A confirmar (não totalizável) */}
          {incertos.length > 0 && (
            <div className="mt-3 rounded-xl p-2.5" style={{ background: 'hsl(38 90% 97%)', border: '1px solid hsl(38 90% 88%)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <HelpCircle size={12} style={{ color: '#b45309' }} />
                <span className="text-[10.5px] font-bold" style={{ color: '#b45309' }}>A confirmar manualmente</span>
              </div>
              {incertos.map(i => (
                <p key={i.produto} className="text-[10px] text-muted-foreground leading-snug">
                  · <strong className="text-foreground/80">{i.produto}</strong> — {i.motivo}
                </p>
              ))}
            </div>
          )}

          <p className="text-[9px] text-muted-foreground/70 mt-2.5 leading-tight">
            Soma dos agendamentos do cronograma dos lotes, menos o estoque atual. Confira sempre o rótulo antes de comprar e aplicar.
          </p>
        </>
      )}
    </motion.div>
  );
}
