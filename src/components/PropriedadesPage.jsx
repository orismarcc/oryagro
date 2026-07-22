import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Layers, ChevronRight, AlertTriangle, Ruler, CheckCircle2, Leaf } from 'lucide-react';
import {
  loadPropriedades, createPropriedade, updatePropriedade, deletePropriedade, countLotesByPropriedade, loadTodosLotes,
} from '../hooks/useSupabaseSync';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle } from '../lib/lifecycle';
import { useFarm } from '../context/FarmContext';
import { can, FARM_ACTIONS } from '../lib/permissions';

const BRAND = 'hsl(156 64% 31%)';
const GOLD  = 'hsl(36 92% 42%)';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} style={{ color: accent ? GOLD : BRAND }} />
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-[20px] font-black leading-none tabular-nums" style={{ color: accent ? GOLD : 'var(--fg)' }}>{value}</p>
    </div>
  );
}

function PropriedadeForm({ initial, onSave, onCancel, saving }) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [desc, setDesc] = useState(initial?.descricao || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), descricao: desc.trim() || null });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <p className="text-[13px] font-bold text-foreground">{initial ? 'Editar propriedade' : 'Nova propriedade'}</p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome *</label>
        <input
          type="text" value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Ex: Sítio Portuga" required
          className="w-full mt-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'hsl(140 14% 96%)', border: '1px solid hsl(140 13% 88%)' }}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</label>
        <input
          type="text" value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Ex: 5 ha, Mato Grosso"
          className="w-full mt-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'hsl(140 14% 96%)', border: '1px solid hsl(140 13% 88%)' }}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border"
          style={{ borderColor: 'hsl(140 13% 88%)', color: 'hsl(150 8% 45%)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving || !nome.trim()}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: 'hsl(156 64% 31%)' }}>
          {saving ? 'Salvando…' : initial ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}

export default function PropriedadesPage({ onBack, onSelectPropriedade, onRefreshNeeded }) {
  const { getUserRole, refreshMemberships } = useFarm();

  const [propriedades, setPropriedades] = useState([]);
  const [loteCounts, setLoteCounts]     = useState({});
  const [lotes, setLotes]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [saving, setSaving]             = useState(false);
  const [createError, setCreateError]   = useState(null);

  const reload = async () => {
    const [props, counts, ls] = await Promise.all([
      loadPropriedades(), countLotesByPropriedade(), loadTodosLotes(300).catch(() => []),
    ]);
    setPropriedades(props);
    setLoteCounts(counts);
    setLotes(ls || []);
  };

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  const handleCreate = async (payload) => {
    setSaving(true);
    setCreateError(null);
    const row = await createPropriedade(payload);
    if (row) {
      setPropriedades(prev => [...prev, row].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setLoteCounts(prev => ({ ...prev, [row.id]: 0 }));
      setShowForm(false);
      await refreshMemberships();
      onRefreshNeeded?.();
    } else {
      setCreateError('Não foi possível criar a propriedade. Tente novamente.');
    }
    setSaving(false);
  };

  const handleUpdate = async (id, payload) => {
    // Defesa em profundidade: além do botão já gated na UI, revalida o papel
    // aqui (RLS no servidor é a barreira final, isto evita chamadas inúteis).
    if (!can(getUserRole(id), FARM_ACTIONS.EDIT_FARM)) return;
    setSaving(true);
    const row = await updatePropriedade(id, payload);
    if (row) { setPropriedades(prev => prev.map(p => p.id === id ? row : p)); setEditingId(null); }
    setSaving(false);
  };

  // ── Métricas por propriedade (área, culturas, prontos p/ colheita) ──
  const metricasPorProp = useMemo(() => {
    const map = {};
    lotes.forEach(l => {
      const pid = l.propriedade_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { area: 0, culturas: new Set(), prontos: 0, ativos: 0 };
      map[pid].area += parseFloat(l.area_ha) || 0;
      if (l.cultura_id) map[pid].culturas.add(l.cultura_id);
      if (l.status !== 'concluido') map[pid].ativos += 1;
      const c = CULTURAS[l.cultura_id];
      try { if (c && resolveLifecycle(l, c).prontoParaColheita) map[pid].prontos += 1; } catch { /* lote sem data válida */ }
    });
    return map;
  }, [lotes]);

  const resumoGeral = useMemo(() => {
    const vals = Object.values(metricasPorProp);
    return {
      area: Math.round(vals.reduce((s, m) => s + m.area, 0) * 100) / 100,
      lotes: lotes.filter(l => l.propriedade_id).length,
      prontos: vals.reduce((s, m) => s + m.prontos, 0),
    };
  }, [metricasPorProp, lotes]);

  const handleDelete = async (id) => {
    if (!can(getUserRole(id), FARM_ACTIONS.DELETE_ANY)) return;
    setConfirmDeleteId(null);
    setDeletingId(id);
    const ok = await deletePropriedade(id);
    if (ok) {
      setPropriedades(prev => prev.filter(p => p.id !== id));
      await refreshMemberships();
      onRefreshNeeded?.();
    }
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero px-5 pb-6" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Início
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
            <Building2 size={18} color="white" />
          </div>
          <div>
            <h1 className="font-display text-white text-xl font-extrabold leading-tight">Propriedades</h1>
            <p className="text-white/55 text-[11px] mt-0.5">{propriedades.length} propriedade{propriedades.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="page-body pt-4 pb-32 space-y-4">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            {/* ── Resumo geral ── */}
            {propriedades.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard icon={Building2} label="Propriedades" value={propriedades.length} />
                <StatCard icon={Leaf} label="Lotes" value={resumoGeral.lotes} />
                <StatCard icon={Ruler} label="Área total" value={`${resumoGeral.area.toLocaleString('pt-BR')} ha`} />
                <StatCard icon={CheckCircle2} label="P/ colheita" value={resumoGeral.prontos} accent={resumoGeral.prontos > 0} />
              </div>
            )}
            {propriedades.length > 0 && <p className="section-label px-0.5 pt-1">Suas propriedades</p>}
            {propriedades.length === 0 && !showForm && (
              <button
                onClick={() => { setShowForm(true); setEditingId(null); }}
                className="w-full card p-6 flex flex-col items-center gap-2.5 text-center transition-transform active:scale-[0.98]"
                style={{ borderStyle: 'dashed', borderColor: 'hsl(156 64% 31% / 0.4)' }}
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-2xl" style={{ background: 'hsl(156 64% 31% / 0.1)', color: 'hsl(156 64% 31%)' }}>
                  <Building2 size={20} />
                </span>
                <p className="text-[13px] font-bold text-foreground">Criar primeira propriedade</p>
                <p className="text-[11px] text-muted-foreground max-w-[17rem] leading-snug">
                  A propriedade organiza seus lotes, talhões, estoque e finanças num só lugar.
                </p>
                <span className="mt-1 text-[11px] font-bold px-3 py-1.5 rounded-xl" style={{ background: 'hsl(156 64% 31%)', color: '#fff' }}>
                  + Nova Propriedade
                </span>
              </button>
            )}

            <AnimatePresence>
              {propriedades.map((p, i) => {
                const count = loteCounts[p.id] || 0;
                const role = getUserRole(p.id);
                const isMember = role === 'technician';
                if (editingId === p.id) {
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <PropriedadeForm initial={p} onSave={payload => handleUpdate(p.id, payload)} onCancel={() => setEditingId(null)} saving={saving} />
                    </motion.div>
                  );
                }
                const met = metricasPorProp[p.id] || { area: 0, culturas: new Set(), prontos: 0, ativos: 0 };
                const emojis = [...met.culturas].map(cid => CULTURAS[cid]?.emoji).filter(Boolean).slice(0, 5);
                const corProp = isMember ? 'hsl(217 91% 60%)' : BRAND;
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.04, duration: 0.25 }}>
                    <button onClick={() => onSelectPropriedade(p)} className="card-interactive w-full text-left overflow-hidden"
                      style={{ borderLeft: `3px solid ${corProp}` }}>
                      {/* Header */}
                      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${corProp.replace(')', ' / 0.1)')}` }}>
                          <Building2 size={19} style={{ color: corProp }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[14.5px] font-bold text-foreground leading-tight truncate">{p.nome}</p>
                            {isMember && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'hsl(217 91% 60% / 0.12)', color: 'hsl(217 91% 45%)' }}>
                                Técnico
                              </span>
                            )}
                            {met.prontos > 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'hsl(36 92% 50% / 0.16)', color: 'hsl(30 80% 32%)' }}>
                                🌾 {met.prontos} p/ colheita
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {p.descricao || [p.cidade, p.estado].filter(Boolean).join(' · ') || 'Toque para abrir'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {confirmDeleteId === p.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>
                                {deletingId === p.id ? '…' : 'Excluir'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[10px] font-medium px-2 py-1 rounded-lg"
                                style={{ background: 'hsl(140 14% 93%)', color: 'hsl(150 8% 45%)' }}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* I-10: only admin/owner can edit property name/description */}
                              {can(getUserRole(p.id), FARM_ACTIONS.EDIT_FARM) && (
                                <button onClick={() => { setEditingId(p.id); setShowForm(false); }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                                  <Pencil size={13} />
                                </button>
                              )}
                              {can(getUserRole(p.id), FARM_ACTIONS.DELETE_ANY) && (
                                <button onClick={() => { setConfirmDeleteId(p.id); setEditingId(null); }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                              <ChevronRight size={14} className="opacity-30" />
                            </>
                          )}
                        </div>
                      </div>
                      {/* Métricas */}
                      <div className="grid grid-cols-3 gap-px mx-4 mb-3 rounded-xl overflow-hidden" style={{ background: 'hsl(150 16% 91%)' }}>
                        {[
                          [count, `lote${count !== 1 ? 's' : ''}`],
                          [met.area > 0 ? `${met.area.toLocaleString('pt-BR')} ha` : '—', 'área'],
                          [met.ativos, `ativo${met.ativos !== 1 ? 's' : ''}`],
                        ].map(([v, l]) => (
                          <div key={l} className="py-2 text-center" style={{ background: 'hsl(140 20% 97%)' }}>
                            <p className="text-[13px] font-black text-foreground leading-none tabular-nums">{v}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{l}</p>
                          </div>
                        ))}
                      </div>
                      {/* Culturas */}
                      {emojis.length > 0 && (
                        <div className="flex items-center gap-1.5 px-4 pb-3 -mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Culturas</span>
                          <span className="text-[14px] leading-none">{emojis.join(' ')}</span>
                        </div>
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                  <PropriedadeForm onSave={handleCreate} onCancel={() => { setShowForm(false); setCreateError(null); }} saving={saving} />
                  {createError && (
                    <p className="text-[12px] font-medium mt-2 px-1" style={{ color: '#dc2626' }}>
                      {createError}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!showForm && (
              <button onClick={() => { setShowForm(true); setEditingId(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'hsl(156 64% 31% / 0.08)', color: 'hsl(156 64% 31%)', border: '1.5px dashed hsl(156 64% 31% / 0.4)' }}>
                <Plus size={15} /> Nova Propriedade
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
