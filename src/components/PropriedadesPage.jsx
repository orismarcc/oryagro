import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Layers, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  loadPropriedades, createPropriedade, updatePropriedade, deletePropriedade, countLotesByPropriedade,
} from '../hooks/useSupabaseSync';
import { useFarm } from '../context/FarmContext';
import { can, FARM_ACTIONS } from '../lib/permissions';

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
          style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</label>
        <input
          type="text" value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Ex: 5 ha, Mato Grosso"
          className="w-full mt-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border"
          style={{ borderColor: 'hsl(214 20% 88%)', color: 'hsl(215 16% 45%)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving || !nome.trim()}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: 'hsl(160 84% 27%)' }}>
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
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [saving, setSaving]             = useState(false);
  const [createError, setCreateError]   = useState(null);

  const reload = async () => {
    const [props, counts] = await Promise.all([loadPropriedades(), countLotesByPropriedade()]);
    setPropriedades(props);
    setLoteCounts(counts);
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
    setSaving(true);
    const row = await updatePropriedade(id, payload);
    if (row) { setPropriedades(prev => prev.map(p => p.id === id ? row : p)); setEditingId(null); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
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

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            {propriedades.length === 0 && !showForm && (
              <div className="card p-8 flex flex-col items-center gap-3 text-center">
                <Building2 size={32} className="opacity-30" />
                <p className="text-[14px] font-bold text-foreground">Nenhuma propriedade</p>
                <p className="text-[12px] text-muted-foreground">Crie sua primeira propriedade para organizar seus lotes e estoque.</p>
              </div>
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
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.04, duration: 0.25 }}>
                    <button onClick={() => onSelectPropriedade(p)} className="card-interactive w-full text-left p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isMember ? 'hsl(217 91% 60% / 0.1)' : 'hsl(160 84% 27% / 0.1)' }}>
                        <Building2 size={18} style={{ color: isMember ? 'hsl(217 91% 60%)' : 'hsl(160 84% 27%)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[14px] font-bold text-foreground leading-tight truncate">{p.nome}</p>
                          {isMember && (
                            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'hsl(217 91% 60% / 0.12)', color: 'hsl(217 91% 45%)' }}>
                              Técnico
                            </span>
                          )}
                        </div>
                        {p.descricao && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.descricao}</p>}
                        <div className="flex items-center gap-1 mt-1">
                          <Layers size={10} style={{ color: isMember ? 'hsl(217 91% 60%)' : 'hsl(160 84% 27%)' }} />
                          <span className="text-[11px] text-muted-foreground">{count} lote{count !== 1 ? 's' : ''}</span>
                        </div>
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
                              style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
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
                style={{ background: 'hsl(160 84% 27% / 0.08)', color: 'hsl(160 84% 27%)', border: '1.5px dashed hsl(160 84% 27% / 0.4)' }}>
                <Plus size={15} /> Nova Propriedade
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
