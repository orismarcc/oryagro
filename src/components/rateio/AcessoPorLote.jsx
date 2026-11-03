/**
 * AcessoPorLote — dar acesso a uma pessoa só a ALGUNS lotes/talhões da
 * propriedade (em vez da propriedade inteira). Funciona mesmo antes de a
 * pessoa criar a conta: o acesso liga sozinho pelo e-mail.
 *  - AcessoLotesForm: escolhe os lotes, se é sócio (divide despesas) e admin.
 *  - AcessoLotesLista: quem tem acesso por lote, com remoção por lote.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, X, ShieldCheck } from 'lucide-react';
import { addMembro, removeMembro, loadMembrosPorLotes } from '../../hooks/useRateio';
import { CULTURAS } from '../../data/culturas';

const BRAND = 'hsl(156 64% 31%)';
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputStyle = { background: 'hsl(140 14% 96%)', border: '1.5px solid hsl(140 13% 88%)', color: 'hsl(215 20% 16%)' };

const nomeLote = (l) => {
  const c = CULTURAS[l?.cultura_id];
  return `${c?.emoji || '🌱'} ${l?.nome || c?.nome || 'Lote'}`;
};
const ativos = (lotes) => lotes.filter(l => !l.status || l.status === 'ativo');

export function AcessoLotesForm({ lotes = [], onAdded }) {
  const [form, setForm] = useState({ nome: '', email: '', socio: true, admin: false });
  const [marcados, setMarcados] = useState(new Set());
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const toggle = (id) => setMarcados(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const enviar = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!form.nome.trim() || !EMAIL_OK.test(form.email.trim())) { setMsg({ erro: true, t: 'Informe o nome e um e-mail válido.' }); return; }
    if (!marcados.size) { setMsg({ erro: true, t: 'Marque pelo menos um lote.' }); return; }
    setSalvando(true);
    let ok = 0, dup = 0, falha = 0;
    for (const id of marcados) {
      const r = await addMembro(id, { nome: form.nome, email: form.email, papel: form.admin ? 'admin' : 'membro', participaRateio: form.socio });
      if (r.ok) ok += 1; else if (r.duplicado) dup += 1; else falha += 1;
    }
    setSalvando(false);
    if (ok) {
      setMsg({ t: `${form.nome.trim()} agora tem acesso a ${ok} lote(s).${dup ? ` ${dup} já tinha.` : ''}` });
      setForm({ nome: '', email: '', socio: true, admin: false });
      setMarcados(new Set());
      onAdded?.();
    } else {
      setMsg({ erro: true, t: dup ? 'Essa pessoa já tem acesso aos lotes marcados.' : 'Não foi possível dar o acesso.' });
    }
    if (falha) setMsg({ erro: true, t: `${falha} lote(s) falharam. Tente de novo.` });
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Samuel)"
        className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
      <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-mail da conta dele"
        className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />

      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Quais lotes / talhões</p>
      {ativos(lotes).length === 0 && <p className="text-[12px] text-muted-foreground">Nenhum lote ativo nesta propriedade.</p>}
      <div className="flex flex-col gap-1.5">
        {ativos(lotes).map(l => (
          <label key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
            style={{ background: marcados.has(l.id) ? 'hsl(156 40% 93%)' : 'hsl(140 14% 96%)', border: `1.5px solid ${marcados.has(l.id) ? BRAND : 'hsl(140 13% 88%)'}` }}>
            <input type="checkbox" checked={marcados.has(l.id)} onChange={() => toggle(l.id)} />
            <span className="truncate">{nomeLote(l)}</span>
          </label>
        ))}
      </div>

      <label className="flex items-start gap-2 text-[12.5px] font-semibold mt-1">
        <input type="checkbox" className="mt-0.5" checked={form.socio} onChange={e => setForm(f => ({ ...f, socio: e.target.checked }))} />
        <span>Sócio — divide as despesas desses lotes <span className="block text-[11px] font-normal text-muted-foreground">Desmarque para quem só vê e anota (ex.: funcionário).</span></span>
      </label>
      <label className="flex items-start gap-2 text-[12.5px] font-semibold">
        <input type="checkbox" className="mt-0.5" checked={form.admin} onChange={e => setForm(f => ({ ...f, admin: e.target.checked }))} />
        <span>Administrador do lote <span className="block text-[11px] font-normal text-muted-foreground">Pode lançar e editar as despesas desses lotes.</span></span>
      </label>

      <button type="submit" disabled={salvando}
        className="py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
        style={{ background: BRAND }}>
        {salvando && <Loader2 size={14} className="animate-spin" />} Dar acesso
      </button>
      {msg && <p className="text-[12px] font-medium px-1" style={{ color: msg.erro ? '#dc2626' : '#059669' }}>{msg.t}</p>}
      <p className="text-[11px] text-muted-foreground">
        Pode dar o acesso antes de a pessoa criar a conta — quando ela entrar com esse e-mail, já verá só esses lotes.
      </p>
    </form>
  );
}

export function AcessoLotesLista({ lotes = [], versao = 0 }) {
  const [pessoas, setPessoas] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const loteIds = lotes.map(l => l.id).join(',');

  useEffect(() => {
    let cancel = false;
    const ids = loteIds ? loteIds.split(',') : [];
    loadMembrosPorLotes(ids).then(porLote => {
      if (cancel) return;
      const m = new Map();
      Object.values(porLote).flat().forEach(x => {
        const k = x.email.toLowerCase();
        const p = m.get(k) || { email: x.email, nome: x.nome, ativa: false, itens: [] };
        p.ativa = p.ativa || !!x.user_id;
        p.itens.push(x);
        m.set(k, p);
      });
      setPessoas([...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    });
    return () => { cancel = true; };
  }, [loteIds, versao, recarga]);

  const lotePorId = Object.fromEntries(lotes.map(l => [l.id, l]));

  const tirar = async (x) => {
    if (!window.confirm(`Tirar ${x.nome} de ${nomeLote(lotePorId[x.plantio_id])}? As divisões de despesa dele nesse lote também saem.`)) return;
    if (await removeMembro(x.id)) setRecarga(n => n + 1);
  };

  if (!pessoas.length) return null;
  return (
    <div className="mt-4">
      <p className="section-label mb-2 px-1">Acesso por lote</p>
      <div className="card divide-y" style={{ borderColor: 'hsl(140 13% 92%)' }}>
        {pessoas.map(p => (
          <div key={p.email} className="px-4 py-3">
            <p className="text-[13px] font-bold truncate">{p.nome}</p>
            <p className="text-[11px] text-muted-foreground truncate">{p.email} · {p.ativa ? 'conta ativa' : 'aguardando criar a conta'}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.itens.map(x => (
                <span key={x.id} className="inline-flex items-center gap-1 text-[11px] font-semibold pl-2 pr-1 py-1 rounded-lg"
                  style={{ background: 'hsl(156 40% 94%)', color: BRAND }}>
                  {nomeLote(lotePorId[x.plantio_id])}
                  <span className="text-[9.5px] font-bold opacity-80">· {x.participa_rateio === false ? 'acesso' : 'sócio'}</span>
                  {x.papel === 'admin' && <ShieldCheck size={11} />}
                  <button onClick={() => tirar(x)} aria-label={`Tirar ${p.nome} deste lote`}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"><X size={11} className="text-red-400" /></button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
