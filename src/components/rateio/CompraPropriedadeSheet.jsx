/**
 * CompraPropriedadeSheet — o dono da propriedade lança o gasto UMA vez e diz
 * para onde foi: ao digitar a quantidade de cada lote o valor sai proporcional
 * ao valor cheio (editável). Cada lote pode dividir a sua parte entre os sócios.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, Paperclip, Divide } from 'lucide-react';
import { CATEGORIAS_DESPESA, getUnidade } from '../../hooks/useDespesas';
import { loadLotesByPropriedade } from '../../hooks/useSupabaseSync';
import { loadMembrosPorLotes, registrarCompraPropriedade, uploadComprovante } from '../../hooks/useRateio';
import { hojeLocalISO } from '../../hooks/useAtividades';
import { numero, valorProporcional, dividirIgual, diferenca } from '../../lib/rateio';
import { CULTURAS } from '../../data/culturas';
import { useToast } from '../../context/ToastContext';
import RateioEditor from './RateioEditor';

const BRAND = 'hsl(156 64% 31%)';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputStyle = { background: 'hsl(140 14% 96%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': BRAND };
const inputCls = 'w-full rounded-xl border px-3 py-2.5 text-[13px] font-semibold focus:outline-none focus:ring-2';
const Lbl = ({ children }) => <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{children}</label>;

export default function CompraPropriedadeSheet({ propriedade, onClose, onSaved }) {
  const toast = useToast();
  const [lotes, setLotes] = useState([]);
  const [membros, setMembros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [form, setForm] = useState({
    data: hojeLocalISO(), produto: '', categoria: 'Insumos Agrícolas', subcategoria: '',
    quantidade: '', unidade: getUnidade('Insumos Agrícolas', ''), valor: '', prestador: '', observacao: '',
  });
  // destinos[loteId] = { ativo, quantidade, valor, valorManual, rateio: { linhas, pagadorId } }
  const [destinos, setDestinos] = useState({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const ls = (await loadLotesByPropriedade(propriedade.id)).filter(l => !l.status || l.status === 'ativo');
      const ms = await loadMembrosPorLotes(ls.map(l => l.id));
      if (cancel) return;
      setLotes(ls);
      setMembros(ms);
    })();
    return () => { cancel = true; };
  }, [propriedade.id]);

  const subcats = CATEGORIAS_DESPESA.find(c => c.label === form.categoria)?.subcategorias || [];
  const qtdTotal = numero(form.quantidade);
  const valorTotal = numero(form.valor);
  const temQtd = Number.isFinite(qtdTotal) && qtdTotal > 0;

  const setCampo = (k, v) => setForm(f => {
    const n = { ...f, [k]: v };
    if (k === 'categoria') { n.subcategoria = ''; n.unidade = getUnidade(v, ''); }
    if (k === 'subcategoria') n.unidade = getUnidade(f.categoria, v);
    return n;
  });

  // Valor do destino: manual, ou proporcional à quantidade.
  const valorDe = (d) => {
    if (d.valorManual) return numero(d.valor) || 0;
    if (temQtd) return valorProporcional(d.quantidade, qtdTotal, valorTotal) ?? 0;
    return numero(d.valor) || 0;
  };

  const ativos = lotes.filter(l => destinos[l.id]?.ativo);
  const somaDestinos = ativos.reduce((s, l) => s + valorDe(destinos[l.id]), 0);
  const sobra = diferenca(Number.isFinite(valorTotal) ? valorTotal : 0, ativos.map(l => valorDe(destinos[l.id])));

  const setDestino = (id, patch) => setDestinos(ds => ({ ...ds, [id]: { ...(ds[id] || {}), ...patch } }));

  const toggleLote = (id) => setDestino(id, { ativo: !destinos[id]?.ativo });

  const dividirEntreLotes = () => {
    if (!ativos.length) return;
    const n = ativos.length;
    const qs = temQtd ? dividirIgual(qtdTotal, n) : [];
    const vs = dividirIgual(Number.isFinite(valorTotal) ? valorTotal : 0, n);
    const novos = { ...destinos };
    ativos.forEach((l, i) => {
      novos[l.id] = { ...novos[l.id], quantidade: temQtd ? String(qs[i]) : '', valor: String(vs[i]), valorManual: !temQtd };
    });
    setDestinos(novos);
  };

  const nomeLote = (l) => {
    const c = CULTURAS[l.cultura_id];
    return `${c?.emoji || '🌱'} ${l.nome || c?.nome || 'Lote'}`;
  };

  const podeSalvar = Number.isFinite(valorTotal) && valorTotal > 0 && form.data && ativos.length > 0 && sobra >= -0.005;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const r = await registrarCompraPropriedade({
        propriedadeId: propriedade.id,
        data: form.data, categoria: form.categoria, subcategoria: form.subcategoria,
        produto: form.produto, prestador: form.prestador, observacao: form.observacao,
        quantidade: temQtd ? qtdTotal : null, unidade: form.unidade, valor: valorTotal,
        destinos: ativos.map(l => {
          const d = destinos[l.id];
          return {
            plantioId: l.id, quantidade: numero(d.quantidade), valor: valorDe(d),
            rateio: d.rateio?.linhas || [], pagadorMembroId: d.rateio?.pagadorId || null,
          };
        }),
      });
      if (!r.ok) { toast.error('Não foi possível salvar a compra. Verifique a conexão.'); return; }
      for (const f of arquivos) {
        const up = await uploadComprovante(r.despesaId, f);
        if (!up || up.erro) toast.error(`O comprovante "${f.name}" não subiu (foto ou PDF de até 10 MB).`);
      }
      toast.success('Compra lançada e distribuída ✓');
      onSaved?.();
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  const conteudo = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: 'rgb(0 0 0 / 0.45)' }}
      onClick={onClose}>
      <div className="bg-background w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <div>
            <p className="text-[16px] font-extrabold">Compra da propriedade</p>
            <p className="text-[11.5px] text-muted-foreground">{propriedade.nome} · lance uma vez e diga para onde foi</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'hsl(140 14% 93%)' }}><X size={16} /></button>
        </div>

        <div className="px-5 pt-4">
          {/* 1. O que foi comprado */}
          <p className="section-label mb-2">1. O que foi comprado</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Lbl>Data</Lbl>
              <input type="date" value={form.data} onChange={e => setCampo('data', e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><Lbl>Valor total (R$)</Lbl>
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={form.valor}
                onChange={e => setCampo('valor', e.target.value)} className={inputCls} style={inputStyle} /></div>
          </div>
          <div className="mb-3"><Lbl>Produto ou serviço</Lbl>
            <input placeholder="Ex.: Calcário dolomítico" value={form.produto} onChange={e => setCampo('produto', e.target.value)}
              className={inputCls} style={inputStyle} /></div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Lbl>Categoria</Lbl>
              <select value={form.categoria} onChange={e => setCampo('categoria', e.target.value)} className={inputCls} style={inputStyle}>
                {CATEGORIAS_DESPESA.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select></div>
            <div><Lbl>Tipo</Lbl>
              <select value={form.subcategoria} onChange={e => setCampo('subcategoria', e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">—</option>
                {subcats.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          <div className="mb-4"><Lbl>Quantidade total (opcional)</Lbl>
            <div className="flex gap-2">
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="Ex.: 15" value={form.quantidade}
                onChange={e => setCampo('quantidade', e.target.value)} className={inputCls} style={inputStyle} />
              <input value={form.unidade} onChange={e => setCampo('unidade', e.target.value)} aria-label="Unidade"
                className="w-[72px] rounded-xl border px-2 py-2.5 text-[13px] font-bold text-center" style={{ ...inputStyle, color: BRAND }} />
            </div>
            {temQtd && Number.isFinite(valorTotal) && valorTotal > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">= {fmtBRL(valorTotal / qtdTotal)} por {form.unidade || 'un'}</p>
            )}
          </div>

          {/* 2. Para onde foi */}
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">2. Para onde foi</p>
            {ativos.length > 1 && (
              <button onClick={dividirEntreLotes} className="text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ color: BRAND, background: 'hsl(156 40% 94%)' }}><Divide size={12} /> Dividir igual</button>
            )}
          </div>
          {lotes.length === 0 && <p className="text-[12px] text-muted-foreground mb-3">Nenhum lote ativo nesta propriedade.</p>}
          <div className="flex flex-col gap-2 mb-2">
            {lotes.map(l => {
              const d = destinos[l.id] || {};
              const ms = membros[l.id] || [];
              const v = valorDe(d);
              return (
                <div key={l.id} className="card p-3" style={d.ativo ? { boxShadow: `0 0 0 2px ${BRAND}55` } : undefined}>
                  <label className="flex items-center gap-2 text-[13.5px] font-bold cursor-pointer">
                    <input type="checkbox" checked={!!d.ativo} onChange={() => toggleLote(l.id)} />
                    <span className="flex-1 truncate">{nomeLote(l)}</span>
                    {d.ativo && <span style={{ color: BRAND }}>{fmtBRL(v)}</span>}
                  </label>
                  {d.ativo && (
                    <div className="mt-2.5">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {temQtd && (
                          <div><Lbl>Quantidade ({form.unidade})</Lbl>
                            <input type="number" min="0" step="any" inputMode="decimal" value={d.quantidade || ''}
                              onChange={e => setDestino(l.id, { quantidade: e.target.value, valorManual: false })}
                              className={inputCls} style={inputStyle} /></div>
                        )}
                        <div className={temQtd ? '' : 'col-span-2'}><Lbl>Valor (R$){temQtd && !d.valorManual ? ' · automático' : ''}</Lbl>
                          <input type="number" min="0" step="0.01" inputMode="decimal"
                            value={d.valorManual || !temQtd ? (d.valor ?? '') : (v || '')}
                            onChange={e => setDestino(l.id, { valor: e.target.value, valorManual: true })}
                            className={inputCls} style={inputStyle} /></div>
                      </div>
                      {ms.length > 0
                        ? <RateioEditor membros={ms} total={v} cor={BRAND}
                            value={d.rateio || { linhas: [], pagadorId: '' }}
                            onChange={rt => setDestino(l.id, { rateio: rt })} />
                        : <p className="text-[11px] text-muted-foreground">Sem sócios neste lote (cadastre na aba Lote para dividir).</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {ativos.length > 0 && (
            <p className="text-[12px] font-semibold mb-4" style={{ color: sobra < -0.005 ? 'hsl(0 70% 45%)' : 'hsl(150 8% 35%)' }}>
              Distribuído: {fmtBRL(somaDestinos)}
              {sobra > 0.005 && ` · fica na propriedade: ${fmtBRL(sobra)}`}
              {sobra < -0.005 && ` · passou do total em ${fmtBRL(-sobra)}`}
            </p>
          )}

          {/* 3. Comprovante */}
          <p className="section-label mb-2">3. Comprovante (opcional)</p>
          <label className="flex items-center gap-2 w-full rounded-xl border border-dashed px-3 py-2.5 text-[13px] font-semibold cursor-pointer mb-3"
            style={{ borderColor: `${BRAND}60`, color: BRAND }}>
            <Paperclip size={15} />
            {arquivos.length ? `${arquivos.length} arquivo(s) escolhido(s)` : 'Foto ou PDF do pagamento'}
            <input type="file" accept="image/*,application/pdf" multiple hidden
              onChange={e => { setArquivos([...(e.target.files || [])]); e.target.value = ''; }} />
          </label>
          <div className="mb-4"><Lbl>Fornecedor / prestador (opcional)</Lbl>
            <input value={form.prestador} onChange={e => setCampo('prestador', e.target.value)} className={inputCls} style={inputStyle} /></div>

          <button onClick={salvar} disabled={!podeSalvar || salvando}
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: BRAND }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar compra
          </button>
          {!podeSalvar && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Informe o valor total e marque pelo menos um lote.
            </p>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(conteudo, document.body);
}
