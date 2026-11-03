/**
 * DespesaExtras — dentro de cada despesa da lista: quanto cada sócio paga
 * (com "Quitar" nas pendentes) e os comprovantes (foto/PDF) anexados.
 */
import React, { useRef, useState } from 'react';
import { Check, Clock, Paperclip, FileText, Loader2, X } from 'lucide-react';
import { quitarRateio, uploadComprovante, removeComprovante } from '../../hooks/useRateio';
import { useToast } from '../../context/ToastContext';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DespesaExtras({ despesa, rateio = [], anexos = [], cor, onMudou, podeEditar = true }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState(null);

  const quitar = async (r) => {
    setQuitando(r.id);
    const ok = await quitarRateio(r.id, r.status !== 'pago');
    setQuitando(null);
    if (!ok) { toast.error('Não foi possível atualizar o pagamento.'); return; }
    toast.success(r.status === 'pago' ? 'Reaberto como pendente.' : `Quitado: ${r.membro?.nome || ''} ✓`);
    onMudou?.();
  };

  const anexar = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setEnviando(true);
    let falhas = 0;
    for (const f of files) {
      const r = await uploadComprovante(despesa.id, f);
      if (!r || r.erro) falhas += 1;
    }
    setEnviando(false);
    if (falhas) toast.error(`${falhas} arquivo(s) não subiram. Use foto ou PDF de até 10 MB.`);
    else toast.success('Comprovante anexado ✓');
    onMudou?.();
  };

  const remover = async (a) => {
    if (!window.confirm('Remover este comprovante?')) return;
    if (await removeComprovante(a)) onMudou?.();
    else toast.error('Não foi possível remover.');
  };

  const pendentes = rateio.filter(r => r.status === 'pendente');

  return (
    <div className="mt-2">
      {rateio.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {rateio.map(r => {
            const pago = r.status === 'pago';
            return (
              <div key={r.id} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1 min-w-0 truncate">{r.membro?.nome || '—'}</span>
                <span className="font-bold">{fmtBRL(r.valor)}</span>
                <button onClick={() => quitar(r)} disabled={quitando === r.id}
                  title={pago ? 'Toque para reabrir como pendente' : 'Marcar como quitado'}
                  className="min-w-[84px] flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold"
                  style={pago
                    ? { background: 'hsl(152 60% 92%)', color: 'hsl(152 60% 28%)' }
                    : { background: 'hsl(28 90% 52%)', color: '#fff' }}>
                  {quitando === r.id ? <Loader2 size={11} className="animate-spin" />
                    : pago ? <Check size={11} /> : <Clock size={11} />}
                  {pago ? 'Pago' : 'Quitar'}
                </button>
              </div>
            );
          })}
          {pendentes.length > 0 && (
            <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: 'hsl(28 85% 38%)' }}>
              ⚠ Falta quitar {fmtBRL(pendentes.reduce((s, r) => s + Number(r.valor || 0), 0))}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {anexos.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px]"
            style={{ borderColor: `${cor}40` }}>
            <a href={a.url || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold" style={{ color: cor }}>
              {a.mime?.startsWith('image/') && a.url
                ? <img src={a.url} alt="Comprovante" className="w-7 h-7 rounded object-cover" />
                : <FileText size={14} />}
              {a.mime === 'application/pdf' ? 'PDF' : 'Foto'}
            </a>
            {podeEditar && (
              <button onClick={() => remover(a)} aria-label="Remover comprovante" className="text-muted-foreground"><X size={12} /></button>
            )}
          </span>
        ))}
        {podeEditar && (
          <>
            <button onClick={() => inputRef.current?.click()} disabled={enviando}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
              style={{ background: `${cor}12`, color: cor }}>
              {enviando ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
              {anexos.length ? 'Mais comprovante' : 'Anexar comprovante'}
            </button>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={anexar} />
          </>
        )}
      </div>
    </div>
  );
}
