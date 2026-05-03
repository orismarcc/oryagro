import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package2, Plus, Building2, Leaf, CheckCircle2, AlertTriangle, CalendarDays, AlertCircle, Clock, ArrowRight, Users, UserPlus, Shield, Trash2, ChevronDown, Database } from 'lucide-react';
import { loadLotesByPropriedade, deleteLoteCompleto } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';
import { loadFarmMembers, addFarmMember, removeFarmMember, updateFarmMemberRole } from '../hooks/useFarmMembers';
import { supabase } from '../lib/supabase';
import { can, FARM_ACTIONS } from '../lib/permissions';
import BackupModal from './BackupModal';

// I-01: stable step ID matching CronogramaTimeline.makeStableId
function makeStableId(prefix, etapa) {
  const slug = etapa
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug}`;
}

function getStatusEtapas(cultura, lote) {
  if (!cultura?.cronograma) return { atrasadas: 0, hoje: null, amanha: null, proxima: null };
  try {
    const diasDecorridos = Math.max(
      0, Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000)
    );
    const doneStatus = JSON.parse(localStorage.getItem(`cronograma_status_lote_${lote.id}`)) || {};
    const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
      ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
      : null;
    const shift = metodoObj?.diasViveiro
      ?? (localStorage.getItem(`lote_mudas_${lote.id}`) === '1' ? 15 : 0);

    const steps = [
      // I-01: use slug-based stable IDs (matches CronogramaTimeline post-migration)
      ...(metodoObj?.etapasViveiro?.map(e => ({
        ...e,
        _id: makeStableId('viveiro', e.etapa),
        done: doneStatus[makeStableId('viveiro', e.etapa)]?.status === 'feito',
      })) ?? []),
      ...cultura.cronograma.map(e => ({
        ...e,
        dia: e.dia + shift,
        _id: makeStableId('default', e.etapa),
        done: doneStatus[makeStableId('default', e.etapa)]?.status === 'feito',
      })),
    ];
    const pending = steps.filter(s => !s.done);
    const atrasadas = pending.filter(s => s.dia < diasDecorridos).length;
    const hoje   = pending.find(s => s.dia === diasDecorridos) || null;
    const amanha = pending.find(s => s.dia === diasDecorridos + 1) || null;
    const proxima = pending.find(s => s.dia > diasDecorridos + 1) || null;
    return { atrasadas, hoje, amanha, proxima };
  } catch { return { atrasadas: 0, hoje: null, amanha: null, proxima: null }; }
}

function LoteSummaryCard({ lote, onSelect, index, onDeleteLote, canDelete }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;
  const cor = cultura.cor;
  const lc  = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita, faseAtual, faseIndex } = lc;
  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDeleteLote(lote.id);
    setDeleting(false);
  };

  const isCampo = cultura.tipo === 'campo';
  const dimensao = isCampo
    ? `${lote.area_ha ?? '?'} ha`
    : lote.comprimento_m && lote.largura_m
      ? `${lote.comprimento_m}×${lote.largura_m} m`
      : '—';

  // Planting method label
  const metodoLabel = lote.metodo_propagacao && cultura.metodosPropagacao
    ? (cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao)?.label ?? null)
    : null;

  // Schedule status badge
  const scheduleStatus = (() => {
    if (diasDecorridos <= 0) return { label: 'Futuro', bg: '#dbeafe', color: '#2563eb' };
    const { atrasadas } = getStatusEtapas(cultura, lote);
    if (atrasadas > 0) return { label: `${atrasadas} pendente${atrasadas > 1 ? 's' : ''}`, bg: '#fee2e2', color: '#dc2626' };
    return { label: 'Em dia', bg: '#dcfce7', color: '#16a34a' };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="card w-full p-4 relative"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      <button
        onClick={() => onSelect(lote)}
        className="w-full text-left"
      >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${cor}15` }}>
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
            {prontoParaColheita ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            ) : faseAtual && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: faseColor.bg, color: faseColor.text }}>
                <Leaf size={9} /> {faseAtual}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium">{cultura.nome}</span>
            <span className="text-[11px] text-muted-foreground">{dimensao}</span>
            {metodoLabel && (
              <span className="text-[11px] text-muted-foreground">{metodoLabel}</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={9} style={{ color: cor }} />
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right ml-1 flex flex-col items-end gap-1">
          <p className="text-[13px] font-black leading-none" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[9px] text-muted-foreground">
            {prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}
          </p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: scheduleStatus.bg, color: scheduleStatus.color }}>
            {scheduleStatus.label}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        {lote.total_plantas > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">
              {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
            </span>
            <span className="text-[10px] text-muted-foreground opacity-50">·</span>
          </>
        )}
        <span className="text-[11px] font-bold" style={{ color: prontoParaColheita ? '#16a34a' : cor }}>
          {progresso}% até 1ª colheita
        </span>
        {!prontoParaColheita && (
          <>
            <span className="text-[10px] text-muted-foreground opacity-50">·</span>
            <span className="text-[11px] text-muted-foreground">
              {fmtDiasRestantes(diasParaColheita)}
            </span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }} />
      </div>

      {/* Next step / alerts */}
      {!prontoParaColheita && (() => {
        const { atrasadas, hoje, amanha, proxima } = getStatusEtapas(cultura, lote);
        if (!atrasadas && !hoje && !amanha && !proxima) return null;
        return (
          <div className="mt-2.5 pt-2.5 flex flex-wrap gap-1.5"
            style={{ borderTop: '1px solid hsl(214 20% 92%)' }}>
            {atrasadas > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertCircle size={9} /> {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
              </span>
            )}
            {hoje && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fff7ed', color: '#ea580c' }}>
                <Clock size={9} /> Hoje: {hoje.etapa}
              </span>
            )}
            {amanha && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dbeafe', color: '#2563eb' }}>
                ↗ Amanhã: {amanha.etapa}
              </span>
            )}
            {!hoje && !amanha && proxima && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                <ArrowRight size={9} /> {proxima.etapa} · D{proxima.dia}
              </span>
            )}
          </div>
        );
      })()}
      </button>

      {/* Delete control */}
      {canDelete && (
        <div className="mt-2.5 pt-2.5 flex justify-end" style={{ borderTop: '1px solid hsl(214 20% 92%)' }}>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1">Excluir lote?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                {deleting ? '…' : 'Confirmar'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                className="text-[10px] font-medium px-2.5 py-1 rounded-lg"
                style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-red-500 transition-colors py-0.5 px-1">
              <Trash2 size={11} /> Excluir lote
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function FarmMembersSection({ propriedade, userRole }) {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('technician');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success'|'error', text: string }
  const [confirmRemove, setConfirmRemove] = useState(null); // memberId to confirm

  // Load current user id (to identify owner vs others)
  const [currentUserId, setCurrentUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!propriedade?.id) return;
    loadFarmMembers(propriedade.id).then(ms => {
      setMembers(ms);
      setLoadingMembers(false);
    });
  }, [propriedade?.id]);

  if (!can(userRole, FARM_ACTIONS.MANAGE_MEMBERS)) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setMsg(null);
    const result = await addFarmMember(propriedade.id, email.trim(), role, currentUserId);
    if (result.success) {
      setMembers(prev => [...prev, result.member]);
      setEmail('');
      setMsg({ type: 'success', text: 'Usuário adicionado com sucesso.' });
    } else {
      setMsg({ type: 'error', text: result.error });
    }
    setAdding(false);
  };

  const handleRemove = async (memberId) => {
    setConfirmRemove(null);
    const ok = await removeFarmMember(memberId);
    if (ok) setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleRoleChange = async (memberId, newRole) => {
    const ok = await updateFarmMemberRole(memberId, newRole);
    if (ok) setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  const getInitials = (name, email) => {
    const n = name || email || '?';
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <p className="section-label flex-1">Usuários da Propriedade</p>
        <span className="text-[11px] text-muted-foreground">{members.length} {members.length === 1 ? 'membro' : 'membros'}</span>
      </div>

      {/* Add user form */}
      <div className="card p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={14} className="text-green-600" />
          <span className="text-[13px] font-bold text-foreground">Adicionar usuário</span>
        </div>
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail do usuário"
            required
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
            >
              <option value="admin">Administrador</option>
              <option value="technician">Técnico</option>
            </select>
            <button
              type="submit"
              disabled={adding || !email.trim()}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'hsl(160 84% 27%)' }}
            >
              {adding ? '…' : 'Adicionar'}
            </button>
          </div>
          {msg && (
            <p className="text-[12px] font-medium px-1"
              style={{ color: msg.type === 'success' ? '#059669' : '#dc2626' }}>
              {msg.text}
            </p>
          )}
        </form>
      </div>

      {/* Members list */}
      {loadingMembers ? (
        <div className="h-12 rounded-2xl bg-muted animate-pulse" />
      ) : members.length === 0 ? (
        <div className="card p-4 text-center">
          <p className="text-[12px] text-muted-foreground">Nenhum membro adicionado ainda.</p>
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'hsl(214 20% 92%)' }}>
          {members.map(m => {
            const isOwner = m.user_id === propriedade.user_id;
            const isSelf = m.user_id === currentUserId;
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white"
                  style={{ background: isOwner ? 'hsl(160 84% 27%)' : 'hsl(215 16% 55%)' }}>
                  {getInitials(m.displayName, m.email)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">
                    {m.displayName || m.email}
                    {isSelf && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(você)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                </div>
                {/* Role + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOwner ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                      Proprietário
                    </span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer"
                      style={{
                        background: m.role === 'admin' ? '#dbeafe' : '#dcfce7',
                        color:      m.role === 'admin' ? '#1d4ed8' : '#16a34a',
                      }}
                    >
                      <option value="admin">Administrador</option>
                      <option value="technician">Técnico</option>
                    </select>
                  )}
                  {!isOwner && (
                    confirmRemove === m.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleRemove(m.id)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg"
                          style={{ background: '#fee2e2', color: '#dc2626' }}>
                          Confirmar
                        </button>
                        <button onClick={() => setConfirmRemove(null)}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg"
                          style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRemove(m.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PropriedadePage({ propriedade, userRole, onBack, onSelectLote, onGoEstoque, onAddLote }) {
  const [lotes, setLotes]         = useState([]);
  const [alertas, setAlertas]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const [showBackup, setShowBackup] = useState(false);

  useEffect(() => {
    Promise.all([
      loadLotesByPropriedade(propriedade.id),
      loadEstoque(propriedade.id),
    ]).then(([ls, insumos]) => {
      setLotes(ls);
      setAlertas(insumos.filter(i => i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0).length);
      setLoading(false);
    });
  }, [propriedade.id]);

  const handleDeleteLote = async (id) => {
    const ok = await deleteLoteCompleto(id);
    if (ok) setLotes(prev => prev.filter(l => l.id !== id));
  };

  const canDeleteLote = can(userRole, FARM_ACTIONS.DELETE_ANY);

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero px-5 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Propriedades
        </button>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
              <Building2 size={22} color="white" />
            </div>
            <div>
              <h1 className="font-display text-white text-xl font-extrabold leading-tight">{propriedade.nome}</h1>
              {propriedade.descricao && <p className="text-white/55 text-[12px] mt-0.5">{propriedade.descricao}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onGoEstoque}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Package2 size={13} /> Estoque
            {alertas > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: '#dc2626', color: '#fff' }}>
                {alertas}
              </span>
            )}
          </button>
          <button onClick={onAddLote}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Plus size={13} /> Novo Lote
          </button>
          {canDeleteLote && (
            <button onClick={() => setShowBackup(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Database size={13} /> Backup
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="section-label">Lotes</p>
          <span className="text-[11px] text-muted-foreground">{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : lotes.length === 0 ? (
          <div className="card p-8 flex flex-col items-center gap-3 text-center">
            <Leaf size={32} className="opacity-30" />
            <p className="text-[14px] font-bold text-foreground">Nenhum lote nesta propriedade</p>
            <p className="text-[12px] text-muted-foreground">Adicione o primeiro lote clicando em "Novo Lote" acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lotes.map((lote, i) => (
              <LoteSummaryCard
                key={lote.id}
                lote={lote}
                onSelect={onSelectLote}
                index={i}
                onDeleteLote={handleDeleteLote}
                canDelete={canDeleteLote}
              />
            ))}
          </div>
        )}

        <FarmMembersSection propriedade={propriedade} userRole={userRole} />
      </div>

      {showBackup && (
        <BackupModal propriedade={propriedade} onClose={() => setShowBackup(false)} />
      )}
    </div>
  );
}
