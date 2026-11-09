/**
 * RateioEditor — divide uma despesa entre os sócios do lote.
 *
 * Partes iguais por padrão; cada valor pode ser alterado (os demais se
 * reajustam para fechar o total). "Quem pagou?" define quem adiantou o
 * dinheiro: essa pessoa fica "Pago" e as outras "Pendente" até a quitação.
 * Desmarcar um sócio o deixa fora da divisão (quem pagou pode estar fora: adiantou
 * o dinheiro sem ter parte na despesa).
 * Controlado: value = { linhas, pagadorId }, onChange(novoValue).
 */
import React, { useEffect, useRef } from 'react';
import { Users, Check, Clock, Divide } from 'lucide-react';
import { rateioInicial, redistribuir, alternarMembro, diferenca, numero } from '../../lib/rateio';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RateioEditor({ membros, total, value, onChange, cor }) {
  const editadas = useRef(new Set());
  const totalNum = numero(total);
  const linhas = value?.linhas || [];
  const pagadorId = value?.pagadorId || '';

  const ultimoTotal = useRef(totalNum);

  // Monta as linhas quando os membros chegam (ou mudam) e o rateio está vazio.
  useEffect(() => {
    if (!membros.length || linhas.length) return;
    editadas.current = new Set();
    ultimoTotal.current = totalNum;
    onChange({ linhas: rateioInicial(membros, Number.isFinite(totalNum) ? totalNum : 0, pagadorId || null), pagadorId });
  }, [membros, linhas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Total mudou → redistribui entre quem não foi editado à mão.
  useEffect(() => {
    if (!linhas.length || Object.is(ultimoTotal.current, totalNum)) return;
    ultimoTotal.current = totalNum;
    onChange({ linhas: redistribuir(linhas, Number.isFinite(totalNum) ? totalNum : 0, editadas.current), pagadorId });
  }, [totalNum]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!membros.length) return null;

  const setValor = (membroId, v) => {
    editadas.current.add(membroId);
    // se todas foram editadas, a última editada manda; nada a redistribuir
    if (editadas.current.size >= linhas.filter(l => l.incluido !== false).length) editadas.current = new Set([membroId]);
    const novas = linhas.map(l => (l.membroId === membroId ? { ...l, valor: v } : l));
    onChange({ linhas: redistribuir(novas, Number.isFinite(totalNum) ? totalNum : 0, editadas.current), pagadorId });
  };

  const toggleIncluido = (membroId) => {
    const r = alternarMembro(linhas, membroId, Number.isFinite(totalNum) ? totalNum : 0, editadas.current, pagadorId || null);
    editadas.current = r.editadas;
    onChange({ linhas: r.linhas, pagadorId });
  };

  const toggleStatus = (membroId) => onChange({
    linhas: linhas.map(l => (l.membroId === membroId ? { ...l, status: l.status === 'pago' ? 'pendente' : 'pago' } : l)),
    pagadorId,
  });

  const setPagador = (id) => onChange({
    linhas: linhas.map(l => ({ ...l, status: !id || l.membroId === id ? 'pago' : 'pendente' })),
    pagadorId: id,
  });

  const dividirIgual = () => {
    editadas.current = new Set();
    onChange({ linhas: redistribuir(linhas, Number.isFinite(totalNum) ? totalNum : 0, new Set()), pagadorId });
  };

  const dif = diferenca(Number.isFinite(totalNum) ? totalNum : 0, linhas.map(l => l.valor));
  const fecha = Math.abs(dif) < 0.005;
  const ninguem = linhas.length > 0 && linhas.every(l => l.incluido === false);
  const inputStyle = { background: 'hsl(140 14% 96%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': cor };

  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: `${cor}08`, border: `1px solid ${cor}25` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: cor }}>
          <Users size={13} /> Divisão entre os sócios
        </p>
        <button type="button" onClick={dividirIgual}
          className="text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ color: cor, background: `${cor}14` }}>
          <Divide size={12} /> Dividir igual
        </button>
      </div>

      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Quem pagou?</label>
      <select value={pagadorId} onChange={e => setPagador(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-[13px] font-semibold mb-3 focus:outline-none focus:ring-2" style={inputStyle}>
        <option value="">Cada um pagou a sua parte</option>
        {membros.map(m => <option key={m.id} value={m.id}>{m.nome} pagou tudo (os outros ficam devendo)</option>)}
      </select>

      <div className="flex flex-col gap-2">
        {linhas.map(l => {
          const pago = l.status === 'pago';
          const dentro = l.incluido !== false;
          return (
            <div key={l.membroId} className="flex items-center gap-2 min-h-[34px]">
              <label className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dentro} onChange={() => toggleIncluido(l.membroId)}
                  aria-label={`Incluir ${l.nome} na divisão`} className="flex-shrink-0" />
                <span className={`text-[13px] font-semibold truncate ${dentro ? '' : 'line-through text-muted-foreground'}`}>{l.nome}</span>
              </label>
              {!dentro ? (
                <span className="text-[11px] font-semibold text-muted-foreground flex-shrink-0">Fora da divisão</span>
              ) : (<>
              <input type="number" min="0" step="0.01" inputMode="decimal"
                aria-label={`Parte de ${l.nome}`}
                value={l.valor}
                onChange={e => setValor(l.membroId, e.target.value)}
                className="w-[84px] rounded-lg border px-2 py-1.5 text-[13px] font-bold text-right focus:outline-none focus:ring-2" style={inputStyle} />
              <button type="button" onClick={() => toggleStatus(l.membroId)}
                className="w-[86px] flex-shrink-0 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold"
                style={pago
                  ? { background: 'hsl(152 60% 92%)', color: 'hsl(152 60% 28%)' }
                  : { background: 'hsl(38 95% 90%)', color: 'hsl(28 85% 35%)' }}>
                {pago ? <Check size={12} /> : <Clock size={12} />}{pago ? 'Pago' : 'Pendente'}
              </button>
              </>)}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2 font-semibold" style={{ color: fecha ? 'hsl(152 60% 30%)' : 'hsl(28 85% 38%)' }}>
        {ninguem
          ? 'Ninguém na divisão: a despesa fica sem sócios.'
          : fecha
          ? `Soma das partes: ${fmtBRL(numero(total) || 0)} ✓`
          : dif > 0 ? `Falta dividir ${fmtBRL(dif)}` : `As partes passam do total em ${fmtBRL(-dif)}`}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-1">
        Desmarque quem não entra neste pagamento. Toque em Pago/Pendente para mudar. Quem ficar pendente aparece em destaque no Início até quitar.
      </p>
    </div>
  );
}
