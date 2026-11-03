/**
 * MembrosLoteCard — sócios do lote (aba Lote). Cada sócio entra pelo e-mail;
 * quando a pessoa cria a conta com esse e-mail, passa a ver este lote sozinha.
 * Administrador do lote pode lançar e editar despesas do lote.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, Loader2, ShieldCheck, Mail } from 'lucide-react';
import { loadMembros, addMembro, removeMembro, updateMembro } from '../../hooks/useRateio';
import { useToast } from '../../context/ToastContext';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MembrosLoteCard({ loteId, cor, podeGerir = true }) {
  const toast = useToast();
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', papel: 'membro' });

  const carregar = useCallback(async () => {
    const ms = await loadMembros(loteId);
    setMembros(ms);
    setLoading(false);
  }, [loteId]);

  useEffect(() => {
    let cancel = false;
    loadMembros(loteId).then(ms => { if (!cancel) { setMembros(ms); setLoading(false); } });
    return () => { cancel = true; };
  }, [loteId]);

  const adicionar = async () => {
    if (!form.nome.trim() || !EMAIL_OK.test(form.email.trim())) {
      toast.error('Informe o nome e um e-mail válido.');
      return;
    }
    setSalvando(true);
    const r = await addMembro(loteId, form);
    setSalvando(false);
    if (!r.ok) { toast.error(r.duplicado ? 'Esse e-mail já é sócio deste lote.' : 'Não foi possível adicionar.'); return; }
    toast.success(`${r.membro.nome} adicionado ✓`);
    setForm({ nome: '', email: '', papel: 'membro' });
    setAberto(false);
    carregar();
  };

  const remover = async (m) => {
    if (!window.confirm(`Remover ${m.nome} do lote? As divisões de despesa dele também saem.`)) return;
    if (await removeMembro(m.id)) carregar();
    else toast.error('Não foi possível remover.');
  };

  const alternarPapel = async (m) => {
    if (await updateMembro(m.id, { papel: m.papel === 'admin' ? 'membro' : 'admin' })) carregar();
  };

  const inputStyle = { background: 'hsl(140 14% 96%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': cor };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label flex items-center gap-1.5"><Users size={13} /> Sócios do lote</p>
        {podeGerir && !aberto && (
          <button onClick={() => setAberto(true)} className="text-[12px] font-bold flex items-center gap-1" style={{ color: cor }}>
            <Plus size={14} /> Adicionar
          </button>
        )}
      </div>

      {loading ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground mx-auto" />
      ) : membros.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Nenhum sócio cadastrado. Adicione quem divide os gastos deste lote — as despesas passam a ser divididas entre eles.
        </p>
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: 'hsl(140 13% 90%)' }}>
          {membros.map(m => (
            <div key={m.id} className="flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate flex items-center gap-1.5">
                  {m.nome}
                  {m.papel === 'admin' && (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                      style={{ background: `${cor}18`, color: cor }}><ShieldCheck size={10} /> Admin</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <Mail size={10} /> {m.email} · {m.user_id ? 'conta ativa' : 'aguardando criar a conta'}
                </p>
              </div>
              {podeGerir && (
                <>
                  <button onClick={() => alternarPapel(m)} className="text-[10.5px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                    {m.papel === 'admin' ? 'Tirar admin' : 'Tornar admin'}
                  </button>
                  <button onClick={() => remover(m)} aria-label={`Remover ${m.nome}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-muted-foreground hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {aberto && (
        <div className="mt-3 p-3 rounded-xl flex flex-col gap-2" style={{ background: `${cor}08`, border: `1px solid ${cor}25` }}>
          <input placeholder="Nome (ex.: Samuel)" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="w-full rounded-xl border px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2" style={inputStyle} />
          <input type="email" placeholder="E-mail da conta dele" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2" style={inputStyle} />
          <label className="flex items-center gap-2 text-[12.5px] font-semibold">
            <input type="checkbox" checked={form.papel === 'admin'} onChange={e => setForm(f => ({ ...f, papel: e.target.checked ? 'admin' : 'membro' }))} />
            Administrador do lote (pode lançar e editar despesas)
          </label>
          <div className="flex gap-2">
            <button onClick={adicionar} disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: cor }}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar sócio
            </button>
            <button onClick={() => setAberto(false)} className="px-4 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
