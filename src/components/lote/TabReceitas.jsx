import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { motion } from 'framer-motion';
import { Loader2, Plus, Trash2, DollarSign } from 'lucide-react';
import { CATEGORIAS_RECEITA } from '../../hooks/useDespesas';
import {
  loadVendas,
  addVenda,
  deleteVenda,
} from '../../hooks/useGestao';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { loadCompradores, addParcelas } from '../../hooks/useCompradores';
import { supabase } from '../../lib/supabase';
import { today, formatDatePtBR, fmtBRL, fmtNumber } from './shared';

const DESTINO_OPTIONS = [
  { value: 'feira',          label: 'Feira livre' },
  { value: 'ceasa',          label: 'CEASA' },
  { value: 'cliente_direto', label: 'Cliente direto' },
  { value: 'atravessador',   label: 'Atravessador' },
  { value: 'outros',         label: 'Outros' },
];

const DESTINO_BADGE_STYLE = {
  feira:          { background: '#dcfce7', color: '#166534' },
  ceasa:          { background: '#dbeafe', color: '#1e40af' },
  cliente_direto: { background: '#f3e8ff', color: '#6b21a8' },
  atravessador:   { background: '#ffedd5', color: '#9a3412' },
  outros:         { background: '#f3f4f6', color: '#374151' },
};

function DestinoBadge({ destino }) {
  const style = DESTINO_BADGE_STYLE[destino] ?? DESTINO_BADGE_STYLE.outros;
  const label = DESTINO_OPTIONS.find(d => d.value === destino)?.label ?? destino;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={style}
    >
      {label}
    </span>
  );
}

// Helper: generate installment preview
function gerarParcelas(totalValor, numParcelas, primeiroVencimento) {
  if (!totalValor || !numParcelas || !primeiroVencimento) return [];
  const valorParcela = Math.round((totalValor / numParcelas) * 100) / 100;
  return Array.from({ length: numParcelas }, (_, i) => {
    const base = new Date(primeiroVencimento + 'T12:00:00');
    base.setDate(base.getDate() + i * 30);
    const iso = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
    return { numeroParcela: i + 1, valor: valorParcela, dataVencimento: iso };
  });
}

function TabReceitas({ cultura, lote, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const cor = cultura.cor;
  const toast = useToast();
  const unidadeDefault = cultura.venda?.unidade ?? 'un';

  const [vendas, setVendas] = useState([]);
  const [loadingVendas, setLoadingVendas] = useState(true);
  const [saving, setSaving] = useState(false);

  // Compradores
  const [compradores, setCompradores] = useState([]);

  // Form state
  const [form, setForm] = useState({
    data: today(),
    categoria: CATEGORIAS_RECEITA[0].label,
    quantidade: '',
    unidade: unidadeDefault,
    precoUnitario: cultura.venda?.precoUnitario ?? 0,
    destino: 'feira',
    observacao: '',
    compradorId: '',
  });

  // Pagamento
  const [tipoPagamento, setTipoPagamento] = useState('avista'); // 'avista' | 'parcelado'
    const [avistaStatus, setAvistaStatus] = useState('pago'); // 'pago' | 'pendente'
  const [avistaData, setAvistaData] = useState(today());
  const [numParcelas, setNumParcelas] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(today());
  const [parcelasEditaveis, setParcelasEditaveis] = useState([]);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Auto-generate parcelas preview when relevant inputs change
  useEffect(() => {
    if (tipoPagamento !== 'parcelado') return;
    const total = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);
    const geradas = gerarParcelas(total, parseInt(numParcelas) || 1, primeiroVencimento);
    setParcelasEditaveis(geradas);
  }, [tipoPagamento, form.quantidade, form.precoUnitario, numParcelas, primeiroVencimento]);

  const fetchVendas = useCallback(async () => {
    setLoadingVendas(true);
    try {
      const data = await loadVendas(lote.id);
      setVendas(data ?? []);
    } catch {
      setVendas([]);
    } finally {
      setLoadingVendas(false);
    }
  }, [lote.id]);

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  // Realtime: any INSERT/UPDATE/DELETE in vendas for this lote refreshes the list
  useRealtimeSync('vendas', fetchVendas, { column: 'plantio_id', value: lote.id });

  useEffect(() => {
    loadCompradores().then(data => setCompradores(data ?? []));
  }, []);

  const handleAdd = async () => {
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) return;
    if (!parseFloat(form.precoUnitario) || parseFloat(form.precoUnitario) <= 0) {
      const ok = window.confirm('O preço unitário está em R$ 0,00. Deseja continuar?');
      if (!ok) return;
    }
    setSaving(true);
    try {
      const novaVenda = await addVenda({
        plantioId:     lote.id,
        data:          form.data,
        quantidade:    parseFloat(form.quantidade),
        unidade:       form.unidade,
        precoUnitario: parseFloat(form.precoUnitario) || 0,
        destino:       form.destino,
        observacao:    form.observacao,
        compradorId:   form.compradorId || null,
        categoria:     form.categoria,
      });

      if (novaVenda) {
        const totalVenda = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);

        let parcelasPayload;
        if (tipoPagamento === 'parcelado') {
          parcelasPayload = parcelasEditaveis.map((p, i) => ({
            numeroParcela:  i + 1,
            valor:          parseFloat(p.valor) || 0,
            dataVencimento: p.dataVencimento,
          }));
        } else if (tipoPagamento === 'avista' && avistaStatus === 'pago') {
          parcelasPayload = [{
            numeroParcela:  1,
            valor:          totalVenda,
            dataVencimento: avistaData,
            status:         'pago',
            dataPagamento:  avistaData,
          }];
        } else {
          parcelasPayload = [{
            numeroParcela:  1,
            valor:          totalVenda,
            dataVencimento: avistaData,
          }];
        }

        const parcelasOk = await addParcelas(novaVenda.id, parcelasPayload);
        if (!parcelasOk) {
          // A4-11: Rollback — parcelas não puderam ser criadas; remove a venda
          // para não deixar um registro sem parcelamento (estado inconsistente).
          await deleteVenda(novaVenda.id);
          throw new Error('parcelas_failed');
        }
      }

      await fetchVendas();
      // Reset form but keep destino, unidade, and categoria
      setForm(f => ({
        ...f,
        data: today(),
        quantidade: '',
        precoUnitario: cultura.venda?.precoUnitario ?? 0,
        observacao: '',
        compradorId: '',
      }));
      setAvistaData(today());
      setAvistaStatus('pago');
      setPrimeiroVencimento(today());
      setNumParcelas(2);
      setParcelasEditaveis([]);
    } catch {
      toast.error('Erro ao salvar receita. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVenda = async (id) => {
    if (confirmDeleteId === id) {
      // Second click — confirm
      try {
        // Delete parcelas first to avoid orphaned payment records
        await supabase.from('venda_parcelas').delete().eq('venda_id', id);
        await deleteVenda(id);
        setVendas(prev => prev.filter(v => v.id !== id));
      } catch {}
      setConfirmDeleteId(null);
    } else {
      // First click — ask for confirmation
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const sorted = [...vendas].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  // Summary
  const totalQty = vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
  const totalReceita = vendas.reduce((s, v) => s + (v.quantidade ?? 0) * (v.preco_unitario ?? 0), 0);
  const precoMedio = totalQty > 0 ? totalReceita / totalQty : 0;

  const previewTotal = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);

  const compradorSelecionado = compradores.find(c => c.id === form.compradorId);

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Summary */}
      {vendas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 mb-5"
          style={{ borderColor: `${cor}30` }}
        >
          <p className="section-label mb-3">Resumo de Receitas</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Total vendido</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>
                {fmtNumber(Math.round(totalQty * 100) / 100)} {form.unidade}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Receita total</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalReceita)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Preço médio</p>
              <p className="text-[14px] font-bold text-foreground">{fmtBRL(precoMedio)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Register form */}
      <p className="section-label mb-3">Registrar Receita</p>
      <div className="card p-4 mb-5">
        {/* Categoria */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
          <select
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            {CATEGORIAS_RECEITA.map(c => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Quantidade</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Unidade</label>
            <input
              type="text"
              value={form.unidade}
              onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              placeholder="un"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Preço / unidade</label>
            <div className="flex items-center gap-1">
              <span className="text-[12px] text-muted-foreground font-semibold">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precoUnitario}
                onChange={e => setForm(f => ({ ...f, precoUnitario: e.target.value }))}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Destino</label>
            <select
              value={form.destino}
              onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            >
              {DESTINO_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Observação</label>
            <input
              type="text"
              placeholder="Opcional"
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              maxLength={300}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* Comprador selector */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Comprador</label>
          <select
            value={form.compradorId}
            onChange={e => setForm(f => ({ ...f, compradorId: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            <option value="">Sem comprador</option>
            {compradores.filter(c => c.status !== 'inativo').map(c => (
              <option key={c.id} value={c.id}>{c.nome}{c.tipo ? ` (${c.tipo})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Pagamento config */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Pagamento</label>
          {/* Toggle */}
          <div className="flex gap-1 p-0.5 rounded-xl mb-3"
            style={{ background: 'hsl(210 16% 93%)' }}>
            {[['avista', 'À vista'], ['parcelado', 'Parcelado']].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipoPagamento(v)}
                className="flex-1 py-1.5 rounded-[10px] text-[12px] font-bold transition-all"
                style={tipoPagamento === v
                  ? { background: cor, color: 'white' }
                  : { background: 'transparent', color: 'hsl(215 16% 40%)' }}
              >
                {l}
              </button>
            ))}
          </div>

          {tipoPagamento === 'avista' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data pagamento</label>
                <input
                  type="date"
                  value={avistaData}
                  onChange={e => setAvistaData(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': cor }}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
                <select
                  value={avistaStatus}
                  onChange={e => setAvistaStatus(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': cor }}
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>
          )}

          {tipoPagamento === 'parcelado' && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nº de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={numParcelas}
                    onChange={e => setNumParcelas(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': cor }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Primeiro vencimento</label>
                  <input
                    type="date"
                    value={primeiroVencimento}
                    onChange={e => setPrimeiroVencimento(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': cor }}
                  />
                </div>
              </div>

              {/* Parcelas preview/edit */}
              {parcelasEditaveis.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-input mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 text-muted-foreground"
                    style={{ background: 'hsl(210 16% 97%)' }}>
                    Parcelas (editáveis)
                  </p>
                  {parcelasEditaveis.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderTop: i > 0 ? '1px solid hsl(214 20% 91%)' : undefined }}>
                      <span className="text-[11px] font-bold text-muted-foreground w-5 flex-shrink-0">{i+1}.</span>
                      <input
                        type="date"
                        value={p.dataVencimento}
                        onChange={e => {
                          const updated = [...parcelasEditaveis];
                          updated[i] = { ...updated[i], dataVencimento: e.target.value };
                          setParcelasEditaveis(updated);
                        }}
                        className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1"
                      />
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.valor}
                          onChange={e => {
                            const updated = [...parcelasEditaveis];
                            updated[i] = { ...updated[i], valor: parseFloat(e.target.value) || 0 };
                            setParcelasEditaveis(updated);
                          }}
                          className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-right focus:outline-none focus:ring-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        {parseFloat(form.quantidade) > 0 && (
          <p className="text-[12px] text-muted-foreground mb-3">
            <span className="font-semibold text-foreground">
              {form.quantidade} {form.unidade} × {fmtBRL(parseFloat(form.precoUnitario) || 0)} ={' '}
              <span style={{ color: cor }}>{fmtBRL(previewTotal)}</span>
            </span>
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving || !form.quantidade || parseFloat(form.quantidade) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Registrar Receita
        </motion.button>
      </div>

      {/* History */}
      <p className="section-label mb-3">Histórico de Receitas</p>
      {loadingVendas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma receita registrada ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(entry => {
            const total = (entry.quantidade ?? 0) * (entry.preco_unitario ?? 0);
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-foreground">{formatDatePtBR(entry.data)}</span>
                    {entry.categoria && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${cor}18`, color: cor }}
                      >
                        {entry.categoria}
                      </span>
                    )}
                    <span className="text-[12px] text-muted-foreground">
                      {entry.quantidade} {entry.unidade}
                    </span>
                    <span className="text-[11px] text-muted-foreground">· {fmtBRL(entry.preco_unitario)}/un</span>
                    {entry.destino && <DestinoBadge destino={entry.destino} />}
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: cor }}>{fmtBRL(total)}</p>
                  {entry.observacao && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{entry.observacao}</p>
                  )}
                </div>
                {canDelete && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleDeleteVenda(entry.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                    style={confirmDeleteId === entry.id
                      ? { background: '#fee2e2', color: '#dc2626' }
                      : { color: 'hsl(215 16% 50%)' }}
                  >
                    <Trash2 size={14} />
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TabReceitas;
