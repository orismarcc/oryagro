import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Trash2, Receipt, PackagePlus } from 'lucide-react';
import {
  CATEGORIAS_DESPESA,
  addDespesa,
  loadDespesasByLote,
  deleteDespesa,
  getUnidade,
} from '../../hooks/useDespesas';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { upsertInsumo, addMovimento, deleteMovimentosByDespesa } from '../../hooks/useGestao';
import { today, formatDatePtBR, fmtBRL, fmtNumber } from './shared';

function TabDespesas({ lote, cor, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const toast = useToast();

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [form, setForm] = useState({
    data: today(),
    categoria: CATEGORIAS_DESPESA[0].label,
    subcategoria: '',
    quantidade: '',
    unidade: getUnidade(CATEGORIAS_DESPESA[0].label, ''),
    descricao: '',
    prestador: '',
    valor: '',
    observacao: '',
  });

  // Estoque integration state
  const CATS_COM_ESTOQUE = ['Insumos Agrícolas', 'Embalagem e Comercialização'];
  const showEstoqueToggle = CATS_COM_ESTOQUE.includes(form.categoria);
  const [estoqueForm, setEstoqueForm] = useState({
    enabled: false,
    nomeInsumo: '',
    qtdMinima: '0',
  });

  const subcats = CATEGORIAS_DESPESA.find(c => c.label === form.categoria)?.subcategorias || [];
  const autoUnidade = getUnidade(form.categoria, form.subcategoria);

  // Auto-update unidade when categoria or subcategoria changes
  useEffect(() => {
    setForm(f => ({ ...f, unidade: getUnidade(f.categoria, f.subcategoria) }));
  }, [form.categoria, form.subcategoria]);

  // When categoria changes to one without estoque, disable toggle
  useEffect(() => {
    if (!CATS_COM_ESTOQUE.includes(form.categoria)) {
      setEstoqueForm(e => ({ ...e, enabled: false }));
    }
  }, [form.categoria]);

  // Pre-fill nome insumo from subcategoria or categoria
  useEffect(() => {
    if (!estoqueForm.enabled) return;
    setEstoqueForm(e => ({
      ...e,
      nomeInsumo: form.subcategoria || form.categoria,
    }));
  }, [form.subcategoria, form.categoria, estoqueForm.enabled]);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadDespesasByLote(lote.id);
      setRegistros(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [lote.id]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Realtime: any INSERT/UPDATE/DELETE in despesas for this lote refreshes the list
  useRealtimeSync('despesas', fetchRegistros, { column: 'plantio_id', value: lote.id });

  const handleAdd = async () => {
    if (!form.data || !form.valor || parseFloat(form.valor) <= 0) return;
    setSaving(true);
    try {
      const despesaRow = await addDespesa({
        plantioId:     lote.id,
        propriedadeId: lote.propriedade_id || null,
        categoria:     form.categoria,
        subcategoria:  form.subcategoria || null,
        quantidade:    form.quantidade   || null,
        unidade:       form.quantidade ? form.unidade : null,
        descricao:     form.descricao    || null,
        prestador:     form.prestador    || null,
        valor:         parseFloat(form.valor),
        data:          form.data,
        observacao:    form.observacao   || null,
      });

      // A4-03: Estoque integration — movimento fica vinculado à despesa via despesa_id
      if (estoqueForm.enabled && estoqueForm.nomeInsumo.trim() && lote.propriedade_id && despesaRow?.id) {
        const qtd = parseFloat(form.quantidade) || 0;
        // Preço unitário AUTOMÁTICO: valor total pago ÷ quantidade comprada.
        const precoUnit = (qtd > 0 && parseFloat(form.valor) > 0)
          ? parseFloat(form.valor) / qtd
          : 0;
        const insumo = await upsertInsumo({
          nome:              estoqueForm.nomeInsumo.trim(),
          unidade:           form.unidade || 'un',
          quantidade:        0,                                        // managed via movimentos
          quantidade_minima: parseFloat(estoqueForm.qtdMinima) || 0,
          preco_unitario:    precoUnit,
          propriedadeId:     lote.propriedade_id,
        });
        if (insumo?.id && qtd > 0) {
          await addMovimento({
            insumoId:    insumo.id,
            tipo:        'entrada',
            quantidade:  qtd,
            observacao:  `Despesa: ${form.descricao || form.subcategoria || form.categoria}`,
            data:        form.data,
            plantioId:   lote.id,
            despesaId:   despesaRow.id,
            precoUnitarioMovimento: precoUnit,   // alimenta o preço médio ponderado
          });
        }
      }
      // ───────────────────────────────────────────────────────────────────────

      await fetchRegistros();
      setForm({
        data: today(),
        categoria: CATEGORIAS_DESPESA[0].label,
        subcategoria: '',
        quantidade: '',
        unidade: getUnidade(CATEGORIAS_DESPESA[0].label, ''),
        descricao: '',
        prestador: '',
        valor: '',
        observacao: '',
      });
      setEstoqueForm({ enabled: false, nomeInsumo: '', qtdMinima: '0' });
    } catch {
      toast.error('Erro ao salvar despesa. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      // A4-03: Reverte primeiro o estoque (a FK é ON DELETE SET NULL, então
      // depois da despesa sumir não saberíamos mais a vinculação)
      await deleteMovimentosByDespesa(id);
      await deleteDespesa(id);
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch {
      toast.error('Erro ao excluir despesa.');
    }
    setConfirmDeleteId(null);
  };

  const totalDespesas = registros.reduce((s, r) => s + (r.valor ?? 0), 0);

  // Group by category for summary display
  const porCategoria = registros.reduce((acc, r) => {
    acc[r.categoria] = (acc[r.categoria] || 0) + (r.valor ?? 0);
    return acc;
  }, {});

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Total summary */}
      {registros.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 mb-5"
          style={{ borderColor: `${cor}30` }}
        >
          <p className="section-label mb-1">Total Despesas</p>
          <p className="text-[22px] font-black" style={{ color: cor }}>{fmtBRL(totalDespesas)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{registros.length} registro{registros.length !== 1 ? 's' : ''}</p>

          {/* Category breakdown */}
          {Object.entries(porCategoria).length > 1 && (
            <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: `${cor}20` }}>
              {Object.entries(porCategoria).map(([cat, val]) => (
                <div key={cat} className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground truncate flex-1 mr-2">{cat}</span>
                  <span className="text-[11px] font-bold flex-shrink-0" style={{ color: cor }}>{fmtBRL(val)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Form */}
      <p className="section-label mb-3">Registrar Despesa</p>
      <div className="card p-4 mb-5">
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
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
          <select
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value, subcategoria: '' }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            {CATEGORIAS_DESPESA.map(c => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        {subcats.length > 0 && (
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Subcategoria (opcional)</label>
            <select
              value={form.subcategoria}
              onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            >
              <option value="">Selecionar…</option>
              {subcats.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quantidade + unidade auto */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Quantidade (opcional)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
            <input
              type="text"
              value={form.unidade}
              onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
              className="w-[64px] rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-bold text-center focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor, color: cor }}
              placeholder="un"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Capina geral"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Prestador (opcional)</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={form.prestador}
              onChange={e => setForm(f => ({ ...f, prestador: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
        </div>

        {/* Estoque toggle — só aparece para categorias relevantes */}
        {showEstoqueToggle && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setEstoqueForm(e => ({ ...e, enabled: !e.enabled }))}
              className="flex items-center gap-2 w-full rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors"
              style={{
                borderColor: estoqueForm.enabled ? cor : 'hsl(var(--border))',
                background:  estoqueForm.enabled ? `${cor}12` : 'transparent',
                color:       estoqueForm.enabled ? cor : 'hsl(var(--muted-foreground))',
              }}
            >
              <PackagePlus size={15} />
              Adicionar ao estoque?
              <span
                className="ml-auto w-9 h-5 rounded-full flex items-center transition-colors flex-shrink-0"
                style={{ background: estoqueForm.enabled ? cor : 'hsl(var(--border))' }}
              >
                <span
                  className="w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5"
                  style={{ transform: estoqueForm.enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </span>
            </button>

            <AnimatePresence>
              {estoqueForm.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 rounded-xl space-y-3" style={{ background: `${cor}08`, border: `1px solid ${cor}20` }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cor }}>
                      Dados do Estoque
                    </p>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nome do insumo</label>
                      <input
                        type="text"
                        placeholder="Ex: Fertilizante NPK"
                        value={estoqueForm.nomeInsumo}
                        onChange={e => setEstoqueForm(f => ({ ...f, nomeInsumo: e.target.value }))}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                        style={{ '--tw-ring-color': cor }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Se já existir no estoque com esse nome, a entrada será adicionada ao mesmo item.</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Qtd. mínima</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={estoqueForm.qtdMinima}
                          onChange={e => setEstoqueForm(f => ({ ...f, qtdMinima: e.target.value }))}
                          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': cor }}
                        />
                        <span className="text-[11px] font-bold text-muted-foreground flex-shrink-0">{form.unidade || 'un'}</span>
                      </div>
                    </div>

                    {/* Preço unitário AUTOMÁTICO = valor pago ÷ quantidade */}
                    {(() => {
                      const qtd = parseFloat(form.quantidade) || 0;
                      const val = parseFloat(form.valor) || 0;
                      const precoUnit = (qtd > 0 && val > 0) ? val / qtd : null;
                      return (
                        <div className="flex items-center justify-between rounded-xl px-3 py-2"
                          style={{ background: `${cor}10`, border: `1px solid ${cor}25` }}>
                          <span className="text-[11px] font-semibold" style={{ color: cor }}>Preço unitário (automático)</span>
                          <span className="text-[13px] font-bold" style={{ color: cor }}>
                            {precoUnit !== null
                              ? `${fmtBRL(precoUnit)} / ${form.unidade || 'un'}`
                              : '—'}
                          </span>
                        </div>
                      );
                    })()}

                    <p className="text-[10px] text-muted-foreground">
                      {form.quantidade || '0'} {form.unidade || 'un'} serão registrados como entrada no estoque. O preço unitário é calculado do valor pago ({fmtBRL(parseFloat(form.valor) || 0)}) ÷ quantidade.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving || !form.data || !form.valor || parseFloat(form.valor) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Registrar Despesa
        </motion.button>
      </div>

      {/* List */}
      <p className="section-label mb-3">Registros</p>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12">
          <Receipt size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma despesa registrada ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {registros.map(r => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${cor}18`, color: cor }}
                  >
                    {formatDatePtBR(r.data)}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}
                  >
                    {r.categoria}
                  </span>
                  {r.subcategoria && (
                    <span className="text-[10px] text-muted-foreground">{r.subcategoria}</span>
                  )}
                </div>
                {r.descricao && (
                  <p className="text-[12px] text-foreground mb-0.5">{r.descricao}</p>
                )}
                {r.prestador && (
                  <p className="text-[11px] text-muted-foreground mb-0.5">👤 {r.prestador}</p>
                )}
                <div className="flex items-baseline gap-3">
                  <p className="text-[14px] font-bold" style={{ color: cor }}>{fmtBRL(r.valor)}</p>
                  {r.quantidade != null && (
                    <p className="text-[11px] text-muted-foreground">
                      {fmtNumber(r.quantidade)} {r.unidade}
                    </p>
                  )}
                </div>
              </div>
              {canDelete && (
                confirmDeleteId === r.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-600"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setConfirmDeleteId(r.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </motion.button>
                )
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TabDespesas;
