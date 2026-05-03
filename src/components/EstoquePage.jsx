import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package2, Plus, TrendingUp, TrendingDown, X, Trash2, AlertTriangle, Pencil, ChevronLeft } from 'lucide-react';
import { loadEstoque, upsertInsumo, deleteInsumo, addMovimento, loadMovimentos } from '../hooks/useGestao';
import { logDbError } from '../lib/logger';
import { useFarm } from '../context/FarmContext';
import { can, FARM_ACTIONS } from '../lib/permissions';

// ── Constante de segurança para padding acima da navbar ──────────────────────
// Todos os bottom-sheets devem usar isso no último elemento scrollável.
const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';

const INSUMOS_PADRAO = [
  { nome: 'Calcário dolomítico', unidade: 'kg',  quantidade_minima: 50  },
  { nome: 'Esterco bovino',      unidade: 'kg',  quantidade_minima: 100 },
  { nome: 'NPK 10-10-10',        unidade: 'kg',  quantidade_minima: 25  },
  { nome: 'Ureia 46%',           unidade: 'kg',  quantidade_minima: 20  },
  { nome: 'Nitrato de Cálcio',   unidade: 'kg',  quantidade_minima: 10  },
  { nome: 'Defensivo foliar',    unidade: 'L',   quantidade_minima: 2   },
  { nome: 'Sementes (geral)',    unidade: 'un',  quantidade_minima: 100 },
];

const UNIDADES = ['kg', 'L', 'g', 'mL', 'saco', 'un'];

function statusColor(qty, min) {
  if (qty <= 0)       return '#dc2626';
  if (qty <= min)     return '#d97706';
  return '#059669';
}

function StatusDot({ qty, min }) {
  const c = statusColor(qty, min);
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />;
}

// ── Helper: wrapper de bottom-sheet ─────────────────────────────────────────
function BottomSheet({ onClose, children, maxHeight = '92vh' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="rounded-t-3xl overflow-y-auto"
        style={{ background: 'white', maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(214 20% 88%)' }} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Modal: movimentação ──────────────────────────────────────────────────────

function MovModal({ insumo, onClose, onMoved }) {
  const [tipo, setTipo]     = useState('entrada');
  const [qty, setQty]       = useState('');
  const [obs, setObs]       = useState('');
  const [data, setData]     = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    loadMovimentos(insumo.id).then(setHistorico);
  }, [insumo.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qty || parseFloat(qty) <= 0) return;
    setSaving(true);
    await addMovimento({ insumoId: insumo.id, tipo, quantidade: parseFloat(qty), observacao: obs, data });
    setSaving(false);
    onMoved();
    onClose();
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b" style={{ borderColor: 'hsl(214 20% 91%)' }}>
        <div>
          <h3 className="font-bold text-[15px]">{insumo.nome}</h3>
          <p className="text-[11px] text-muted-foreground">
            Estoque atual: <strong>{insumo.quantidade} {insumo.unidade}</strong>
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4" style={{ paddingBottom: SAFE_BOTTOM }}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { k: 'entrada', l: 'Entrada (compra)', Icon: TrendingUp  },
              { k: 'saida',   l: 'Saída (uso)',      Icon: TrendingDown },
            ].map(({ k, l, Icon }) => (
              <button key={k} type="button" onClick={() => setTipo(k)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                style={tipo === k
                  ? { background: k === 'entrada' ? '#dcfce7' : '#fee2e2', color: k === 'entrada' ? '#16a34a' : '#dc2626', border: `1.5px solid ${k === 'entrada' ? '#86efac' : '#fca5a5'}` }
                  : { background: 'hsl(210 16% 95%)', color: 'hsl(215 16% 45%)' }}>
                <Icon size={13} /> {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Quantidade ({insumo.unidade})
              </label>
              <input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)} required
                className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
                style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Observação (opcional)
            </label>
            <input type="text" value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: Compra na agropecuária"
              className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
          </div>

          <button type="submit" disabled={saving || !qty}
            className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>
            {saving ? 'Salvando…' : tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
          </button>
        </form>

        {historico.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Últimos movimentos
            </p>
            <div className="space-y-1.5">
              {historico.map(m => {
                const [ano, mes, dia] = m.data.split('-');
                return (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: m.tipo === 'entrada' ? '#f0fdf4' : '#fef2f2' }}>
                    {m.tipo === 'entrada'
                      ? <TrendingUp size={11} style={{ color: '#16a34a' }} />
                      : <TrendingDown size={11} style={{ color: '#dc2626' }} />}
                    <span className="text-[12px] font-bold flex-1"
                      style={{ color: m.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade} {insumo.unidade}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{dia}/{mes}/{ano}</span>
                    {(() => {
                      const loteLabel = m.plantio?.nome ? `Lote: ${m.plantio.nome}` : '';
                      return (m.observacao || loteLabel) && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {m.observacao || loteLabel}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Modal: adicionar / editar insumo ─────────────────────────────────────────
// Quando `existingInsumo` é passado, opera em modo edição.

function InsumoFormModal({ onClose, onSaved, propriedadeId, existingInsumo = null }) {
  const isEdit = !!existingInsumo;

  const [nome,    setNome]    = useState(existingInsumo?.nome    ?? '');
  const [unidade, setUnidade] = useState(existingInsumo?.unidade ?? 'kg');
  const [min,     setMin]     = useState(existingInsumo?.quantidade_minima != null ? String(existingInsumo.quantidade_minima) : '');
  const [preco,   setPreco]   = useState(existingInsumo?.preco_unitario != null    ? String(existingInsumo.preco_unitario)    : '');
  // Quantidade inicial — só disponível no cadastro (não no edit, pois a
  // quantidade real é controlada pelas movimentações)
  const [qtdInicial, setQtdInicial] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const qtd = isEdit
      ? existingInsumo.quantidade               // mantém quantidade atual no edit
      : (parseFloat(qtdInicial) || 0);          // usa quantidade inicial no cadastro

    const row = await upsertInsumo({
      id: existingInsumo?.id,
      nome,
      unidade,
      quantidade: qtd,
      quantidade_minima: parseFloat(min)   || 0,
      preco_unitario:    parseFloat(preco) || 0,
      propriedadeId,
    });

    setSaving(false);

    if (!row) return; // erro já logado em upsertInsumo

    // Se estamos cadastrando com quantidade inicial > 0, registra uma
    // movimentação de "entrada" para manter o histórico consistente.
    if (!isEdit && qtd > 0) {
      await addMovimento({
        insumoId: row.id,
        tipo: 'entrada',
        quantidade: qtd,
        observacao: 'Estoque inicial',
        data: new Date().toISOString().split('T')[0],
        plantioId: null,
      });
    }

    onSaved(row);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-3 border-b flex items-center justify-between"
        style={{ borderColor: 'hsl(214 20% 91%)' }}>
        <h3 className="font-bold text-[15px]">
          {isEdit ? `Editar — ${existingInsumo.nome}` : 'Novo insumo'}
        </h3>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
          <X size={14} />
        </button>
      </div>

      {/* Sugestões rápidas — só no cadastro */}
      {!isEdit && (
        <div className="px-5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Sugestões rápidas
          </p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {INSUMOS_PADRAO.map(s => (
              <button key={s.nome} type="button"
                onClick={() => { setNome(s.nome); setUnidade(s.unidade); setMin(String(s.quantidade_minima)); }}
                className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 35%)' }}>
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-5 pt-3 space-y-3"
        style={{ paddingBottom: SAFE_BOTTOM }}>

        {/* Nome */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Nome do insumo
          </label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
            placeholder="Ex: Ureia 46%"
            className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
            style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
        </div>

        {/* Unidade + Qtd mínima */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Unidade
            </label>
            <select value={unidade} onChange={e => setUnidade(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Qtd mínima
            </label>
            <input type="number" min="0" step="0.1" value={min}
              onChange={e => setMin(e.target.value)} placeholder="0"
              className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
          </div>
        </div>

        {/* Quantidade inicial — APENAS no cadastro */}
        {!isEdit && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quantidade inicial ({unidade})
              <span className="ml-1 normal-case font-normal opacity-60">— opcional</span>
            </label>
            <input type="number" min="0" step="0.01" value={qtdInicial}
              onChange={e => setQtdInicial(e.target.value)} placeholder="0"
              className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
              Se você já tem este insumo, informe a quantidade atual. Será registrada como entrada inicial.
            </p>
          </div>
        )}

        {/* Preço unitário */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Preço unitário (R$) — opcional
          </label>
          <input type="number" min="0" step="0.01" value={preco}
            onChange={e => setPreco(e.target.value)} placeholder="0,00"
            className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
            style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
        </div>

        <button type="submit" disabled={saving || !nome}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: 'hsl(160 84% 27%)' }}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar insumo'}
        </button>
      </form>
    </BottomSheet>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Calcula dias restantes de uso baseado nos últimos 30 dias de movimentos tipo 'saida'.
 * Retorna null se não houver histórico suficiente.
 */
function calcDiasRestantes(insumo, movimentos) {
  const hoje = new Date();
  const limite = new Date(hoje.getTime() - 30 * 86_400_000);
  const saidasRecentes = movimentos.filter(m => {
    if (m.tipo !== 'saida') return false;
    if (!m.data) return false;
    return new Date(m.data + 'T12:00:00') >= limite;
  });
  if (saidasRecentes.length === 0) return null;
  const totalSaida = saidasRecentes.reduce((s, m) => s + (m.quantidade ?? 0), 0);
  if (totalSaida <= 0) return null;
  const taxaDiaria = totalSaida / 30;
  return Math.floor(insumo.quantidade / taxaDiaria);
}

export default function EstoquePage({ propriedadeId = null, onBack }) {
  const { getUserRole } = useFarm();
  const userRole = getUserRole(propriedadeId);
  const canDelete = can(userRole, FARM_ACTIONS.DELETE_ANY);
  // I-09: technician can view but not add/edit/delete stock
  const canEdit   = can(userRole, FARM_ACTIONS.EDIT_ESTOQUE);

  const [insumos,    setInsumos]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [movModal,   setMovModal]   = useState(null);   // insumo object | null
  const [addModal,   setAddModal]   = useState(false);
  const [editModal,  setEditModal]  = useState(null);   // insumo object | null
  const [diasPorInsumo, setDiasPorInsumo] = useState({}); // { [insumoId]: dias | null }

  const reload = () => loadEstoque(propriedadeId).then(setInsumos);

  useEffect(() => {
    reload().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propriedadeId]);

  // Load movimentos for all insumos to compute dias restantes
  useEffect(() => {
    if (insumos.length === 0) return;
    let cancelled = false;
    Promise.all(
      insumos.map(i => loadMovimentos(i.id).then(movs => ({ id: i.id, movs })))
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(({ id, movs }) => {
        const insumo = insumos.find(i => i.id === id);
        if (insumo) map[id] = calcDiasRestantes(insumo, movs);
      });
      setDiasPorInsumo(map);
    });
    return () => { cancelled = true; };
  }, [insumos]);

  const alertas = insumos.filter(i => i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0);

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este insumo?')) return;
    await deleteInsumo(id);
    setInsumos(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-6 pb-5">
        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-3"
          >
            <ChevronLeft size={16} />
            <span className="text-[12px] font-semibold">Voltar</span>
          </button>
        )}
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Estoque</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Insumos</h1>
        <p className="text-white/50 text-[11px] mt-1">
          {insumos.length} insumo{insumos.length !== 1 ? 's' : ''} cadastrado{insumos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Action bar */}
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto flex items-center justify-between">
        <p className="section-label">Insumos cadastrados</p>
        {/* I-09: only admin/owner can add insumos */}
        {canEdit && (
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white"
            style={{ background: 'hsl(160 84% 27%)' }}
          >
            <Plus size={13} /> Adicionar insumo
          </button>
        )}
      </div>

      <div className="px-4 pt-2 pb-32 max-w-2xl mx-auto space-y-4">
        {/* Alertas */}
        {alertas.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl p-4"
            style={{ background: 'hsl(38 90% 97%)', border: '1px solid hsl(38 90% 85%)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: '#d97706' }} />
              <p className="text-[12px] font-bold" style={{ color: '#d97706' }}>
                {alertas.length} insumo{alertas.length !== 1 ? 's' : ''} abaixo do mínimo
              </p>
            </div>
            {alertas.map(i => (
              <p key={i.id} className="text-[11px] text-muted-foreground">
                · {i.nome}: {i.quantidade} {i.unidade} (mín. {i.quantidade_minima})
              </p>
            ))}
          </motion.div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : insumos.length === 0 ? (
          <div className="text-center py-16">
            <Package2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-[13px] text-muted-foreground">Nenhum insumo cadastrado.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Adicione os insumos que você usa na propriedade.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insumos.map(insumo => {
              const cor = statusColor(insumo.quantidade, insumo.quantidade_minima);
              const pct = insumo.quantidade_minima > 0
                ? Math.min(100, (insumo.quantidade / (insumo.quantidade_minima * 2)) * 100)
                : 50;
              const dias = diasPorInsumo[insumo.id] ?? null;
              const diasCor = dias !== null && dias < 7 ? '#dc2626' : dias !== null && dias < 30 ? '#d97706' : '#6b7280';
              return (
                <motion.div key={insumo.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-4">
                  <div className="flex items-center gap-3">
                    <StatusDot qty={insumo.quantidade} min={insumo.quantidade_minima} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground leading-none">{insumo.nome}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {insumo.quantidade} {insumo.unidade}
                        {insumo.quantidade_minima > 0 && ` · mín. ${insumo.quantidade_minima} ${insumo.unidade}`}
                      </p>
                      {dias !== null && (
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: diasCor }}>
                          ~{dias} dia{dias !== 1 ? 's' : ''} restante{dias !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Editar — I-09: apenas admin/dono */}
                      {canEdit && (
                        <button
                          onClick={() => setEditModal(insumo)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                          style={{ color: 'hsl(215 16% 50%)' }}
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {/* Movimentar — todos podem registrar uso */}
                      <button
                        onClick={() => setMovModal(insumo)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
                        style={{ background: `${cor}15`, color: cor }}>
                        Movimentar
                      </button>
                      {/* Deletar — I-09: apenas admin/dono */}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(insumo.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 92%)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: cor }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {movModal && (
          <MovModal
            insumo={movModal}
            onClose={() => setMovModal(null)}
            onMoved={reload}
          />
        )}
        {addModal && (
          <InsumoFormModal
            onClose={() => setAddModal(false)}
            onSaved={row => setInsumos(prev => [...prev, row])}
            propriedadeId={propriedadeId}
          />
        )}
        {editModal && (
          <InsumoFormModal
            existingInsumo={editModal}
            onClose={() => setEditModal(null)}
            onSaved={row => setInsumos(prev => prev.map(i => i.id === row.id ? row : i))}
            propriedadeId={propriedadeId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
