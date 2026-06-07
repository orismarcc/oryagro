import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, History, Loader2, ChevronDown } from 'lucide-react';
import { loadAuditLog, tabelaMeta, acaoMeta, resumirDiff } from '../hooks/useAuditLog';

function tempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function EntradaCard({ entrada }) {
  const [aberto, setAberto] = useState(false);
  const tm = tabelaMeta(entrada.tabela);
  const am = acaoMeta(entrada.acao);
  const itens = resumirDiff(entrada.acao, entrada.diff);

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: '#fff' }}>
      <button
        onClick={() => setAberto(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-lg flex-shrink-0">{tm.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-foreground leading-snug">
            <span className="font-bold">{entrada.actorNome}</span>{' '}
            <span style={{ color: am.cor, fontWeight: 600 }}>{am.label}</span>{' '}
            <span className="text-muted-foreground">{tm.label.toLowerCase()}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{tempoRelativo(entrada.created_at)}</p>
        </div>
        {itens.length > 0 && (
          <ChevronDown
            size={14}
            className="flex-shrink-0 text-muted-foreground transition-transform"
            style={{ transform: aberto ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </button>

      {aberto && itens.length > 0 && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-border/60 bg-muted/30">
          {entrada.acao === 'UPDATE' ? (
            <div className="flex flex-col gap-1 mt-1.5">
              {itens.map((it, i) => (
                <div key={i} className="text-[11px] flex flex-wrap items-baseline gap-1">
                  <span className="font-semibold text-foreground">{it.campo}:</span>
                  <span className="text-red-500 line-through">{it.old}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-600 font-semibold">{it.new}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {itens.map((it, i) => (
                <span key={i} className="text-[11px]">
                  <span className="font-semibold text-foreground">{it.campo}:</span>{' '}
                  <span className="text-muted-foreground">{it.valor}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogModal({ onClose }) {
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLog(150).then(rows => {
      setEntradas(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative bg-background rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85svh] flex flex-col overflow-hidden shadow-2xl"
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center gap-2 flex-shrink-0">
          <History size={16} style={{ color: 'hsl(160 84% 27%)' }} />
          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-foreground">Histórico de Alterações</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Quem mudou o quê e quando</p>
          </div>
          <button onClick={onClose} aria-label="Fechar histórico" className="p-1 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: 'none' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : entradas.length === 0 ? (
            <div className="text-center py-16">
              <History size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-[13px] text-muted-foreground">Nenhuma alteração registrada ainda</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Criações, edições e exclusões de lotes, despesas, receitas e vendas aparecerão aqui.
              </p>
            </div>
          ) : (
            entradas.map(e => <EntradaCard key={e.id} entrada={e} />)
          )}
        </div>
      </motion.div>
    </div>
  );
}
