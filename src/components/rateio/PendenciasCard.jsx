/**
 * PendenciasCard — aviso DESTACADO no Início com as partes de despesas que
 * ainda não foram quitadas (quem deve, quanto, de quê). "Quitar" em 1 toque.
 * Some sozinho quando não há pendência.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { loadPendencias, quitarRateio } from '../../hooks/useRateio';
import { pendenciasPorPessoa } from '../../lib/rateio';
import { useToast } from '../../context/ToastContext';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDiaMes = (iso) => { const [, m, d] = String(iso || '').split('-'); return d && m ? `${d}/${m}` : '—'; };

export default function PendenciasCard({ lotePorId = {}, versao }) {
  const toast = useToast();
  const [itens, setItens] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [quitando, setQuitando] = useState(null);

  const carregar = useCallback(async () => {
    try { setItens(await loadPendencias()); } catch { /* offline: sem o aviso */ }
  }, []);
  useEffect(() => {
    let cancel = false;
    loadPendencias().then(rs => { if (!cancel) setItens(rs); }).catch(() => { /* offline: sem o aviso */ });
    return () => { cancel = true; };
  }, [versao]);

  if (!itens.length) return null;

  const porPessoa = pendenciasPorPessoa(itens);
  const total = itens.reduce((s, r) => s + Number(r.valor || 0), 0);

  const quitar = async (r) => {
    setQuitando(r.id);
    const ok = await quitarRateio(r.id, true);
    setQuitando(null);
    if (!ok) { toast.error('Não foi possível quitar.'); return; }
    toast.success(`Quitado: ${r.membro?.nome || ''} ✓`);
    carregar();
  };

  return (
    <div className="mb-5 rounded-2xl overflow-hidden"
      style={{ background: 'hsl(36 100% 96%)', border: '2px solid hsl(32 90% 60%)', boxShadow: '0 8px 20px -14px hsl(28 90% 45%)' }}>
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <AlertTriangle size={20} className="flex-shrink-0" style={{ color: 'hsl(28 90% 45%)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold" style={{ color: 'hsl(26 85% 33%)' }}>
            Pagamentos pendentes · {fmtBRL(total)}
          </p>
          <p className="text-[11.5px] truncate" style={{ color: 'hsl(26 50% 35%)' }}>
            {porPessoa.map(p => `${p.nome} ${fmtBRL(p.total)}`).join(' · ')}
          </p>
        </div>
        {aberto ? <ChevronUp size={16} style={{ color: 'hsl(28 90% 45%)' }} /> : <ChevronDown size={16} style={{ color: 'hsl(28 90% 45%)' }} />}
      </button>

      {aberto && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {itens.map(r => {
            const d = r.despesa || {};
            const lote = lotePorId[d.plantio_id];
            return (
              <div key={r.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold truncate">{r.membro?.nome} deve {fmtBRL(r.valor)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {fmtDiaMes(d.data)} · {d.produto || d.descricao || d.subcategoria || d.categoria}
                    {lote ? ` · ${lote.nome || 'lote'}` : ''}
                  </p>
                </div>
                <button onClick={() => quitar(r)} disabled={quitando === r.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-white"
                  style={{ background: 'hsl(152 55% 35%)' }}>
                  {quitando === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Quitar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
