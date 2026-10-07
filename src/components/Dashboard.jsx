/**
 * Dashboard.jsx — Início: a central do dia.
 *
 * Tudo o que importa sem precisar navegar:
 *  1. Anotar / Agendar (a ação principal do app);
 *  2. Para fazer: agendados atrasados, de hoje e da semana — "Feito" em 1 toque;
 *  3. Avisos reais: estoque abaixo do mínimo e parcelas a receber;
 *  4. Lotes (toque abre o lote) com o último registro de cada um;
 *  5. Últimos registros de todos os lotes.
 * Não há previsões do sistema: só o que o produtor anotou ou agendou.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, CalendarClock, CheckCircle2, Loader2, Package, ChevronRight, Wallet, PencilLine,
} from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes, loadPropriedades } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import {
  loadAtividadesPorLotes, getCategoria, STATUS, dataDoLancamento, hojeLocalISO, concluirLancamento,
} from '../hooks/useAtividades';
import { resolveLifecycle, getFaseColor } from '../lib/lifecycle';
import { supabase } from '../lib/supabase';
import { useAnotar } from '../context/AnotarContext';
import { useToast } from '../context/ToastContext';
import Logo from './Logo';

const BRAND = 'hsl(156 64% 31%)';

/** 'YYYY-MM-DD' → 'DD/MM' sem passar por UTC (evita perder um dia). */
function fmtDiaMes(iso) {
  if (!iso) return '—';
  const [, m, d] = String(iso).split('-');
  return d && m ? `${d}/${m}` : String(iso);
}
function somaDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQ = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export default function Dashboard({ onAddLote, onSelectLote, onGoEstoque, onGoAgenda, onGoCompradores, userName }) {
  const toast = useToast();
  const { anotar, versao, avisarMudanca } = useAnotar();

  const [lotes, setLotes]         = useState([]);
  const [props, setProps]         = useState([]);
  const [estoque, setEstoque]     = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [parcelas, setParcelas]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [concluindo, setConcluindo] = useState(null);

  const hoje = hojeLocalISO();
  const limiteSemana = somaDias(hoje, 7);

  const carregar = useCallback(async () => {
    try {
      const [ls, ps, est] = await Promise.all([loadTodosLotes(100), loadPropriedades(), loadEstoque(null)]);
      const ativos = (ls || []).filter(l => !l.status || l.status === 'ativo');
      setLotes(ativos);
      setProps(ps || []);
      setEstoque(est || []);
      setAtividades(await loadAtividadesPorLotes(ativos.map(l => l.id)));
    } catch (err) {
      console.error('[Inicio] carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar, versao]);

  // Parcelas a receber vencidas ou nos próximos 7 dias
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('venda_parcelas')
          .select('id, valor, data_vencimento')
          .eq('user_id', user.id)
          .eq('status', 'pendente')
          .lte('data_vencimento', limiteSemana)
          .order('data_vencimento', { ascending: true });
        if (!cancel) setParcelas(data || []);
      } catch { /* offline: sem o aviso */ }
    })();
    return () => { cancel = true; };
  }, [limiteSemana, versao]);

  const lotePorId = useMemo(() => Object.fromEntries(lotes.map(l => [l.id, l])), [lotes]);
  const variasProps = props.length > 1;
  const nomeProp = (id) => props.find(p => p.id === id)?.nome;

  // Para fazer: agendados até 7 dias à frente (inclui atrasados)
  const paraFazer = useMemo(() => atividades
    .filter(a => a.status === STATUS.AGENDADO && a.data_prevista && a.data_prevista <= limiteSemana && lotePorId[a.plantio_id])
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)), [atividades, limiteSemana, lotePorId]);

  const recentes = useMemo(() => atividades
    .filter(a => a.status === STATUS.REALIZADO && lotePorId[a.plantio_id])
    .sort((a, b) => (dataDoLancamento(b) || '').localeCompare(dataDoLancamento(a) || '')
      || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 6), [atividades, lotePorId]);

  const ultimoPorLote = useMemo(() => {
    const m = {};
    atividades.forEach(a => {
      if (a.status !== STATUS.REALIZADO) return;
      const d = dataDoLancamento(a) || '';
      if (!m[a.plantio_id] || d > (dataDoLancamento(m[a.plantio_id]) || '')) m[a.plantio_id] = a;
    });
    return m;
  }, [atividades]);

  const estoqueBaixo = estoque.filter(i => Number(i.quantidade_minima) > 0 && Number(i.quantidade) <= Number(i.quantidade_minima));
  const totalReceber = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);

  const concluir = async (a) => {
    setConcluindo(a.id);
    try {
      const r = await concluirLancamento(a, hoje, estoque);
      if (!r) { toast.error('Não foi possível marcar como feito.'); return; }
      toast.success('Feito! ✓');
      avisarMudanca();
    } finally {
      setConcluindo(null);
    }
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dataHojeRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const dataHoje = dataHojeRaw.charAt(0).toUpperCase() + dataHojeRaw.slice(1);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Cabeçalho ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="relative z-10 px-5 pb-16" style={{ paddingTop: 'var(--hero-pad-top)' }}>
          <div className="flex items-center gap-3">
            <Logo size={38} className="flex-shrink-0" style={{ borderRadius: 10 }} />
            <div className="min-w-0">
              <p className="text-white/60 text-[12px] font-medium truncate">
                {saudacao}{userName ? `, ${userName}` : ''} 👋
              </p>
              <p className="text-white text-[15px] font-bold truncate">{dataHoje}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-12 relative z-10 max-w-2xl mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }}>

        {/* ── 1. Ação principal ── */}
        <div className="card p-3 mb-5">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => anotar()}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-extrabold text-white"
              style={{ background: BRAND, boxShadow: `0 10px 22px -12px ${BRAND}` }}>
              <PencilLine size={19} /> Anotar o que fiz
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => anotar({ agendado: true })}
              className="flex flex-col items-center justify-center px-4 rounded-2xl text-[11px] font-bold"
              style={{ background: 'hsl(156 40% 94%)', color: BRAND }}>
              <CalendarClock size={18} /> Agendar
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: BRAND }} /></div>
        ) : lotes.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-[30px] mb-1">🌱</p>
            <p className="text-[15px] font-bold text-foreground">Comece cadastrando um lote</p>
            <p className="text-[12.5px] text-muted-foreground mt-1 mb-4">Cada plantio é um lote. Depois é só anotar o que fizer nele.</p>
            <button onClick={onAddLote} className="px-5 py-3 rounded-xl text-[13px] font-bold text-white" style={{ background: BRAND }}>
              <Plus size={14} className="inline mr-1" /> Novo lote
            </button>
          </div>
        ) : (
          <>
            {/* ── 2. Para fazer ── */}
            <Secao titulo="Para fazer" extra={paraFazer.length ? `${paraFazer.length}` : null}
              acao={{ lbl: 'Agenda', onClick: onGoAgenda }}>
              {paraFazer.length === 0 ? (
                <p className="px-4 py-4 text-[12.5px] text-muted-foreground text-center">
                  Nada agendado para os próximos dias. Use <strong>Agendar</strong> para lembrar do que vem.
                </p>
              ) : paraFazer.map((a, i) => {
                const l = lotePorId[a.plantio_id];
                const c = getCategoria(a.categoria);
                const atrasado = a.data_prevista < hoje;
                const ehHoje = a.data_prevista === hoje;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < paraFazer.length - 1 ? '1px solid hsl(140 13% 93%)' : 'none' }}>
                    <span className="text-[19px] flex-shrink-0">{c.emoji}</span>
                    <button className="flex-1 min-w-0 text-left" onClick={() => anotar({ editar: a })}>
                      <p className="text-[13px] font-bold text-foreground truncate">{a.etapa}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {CULTURAS[l.cultura_id]?.emoji} {l.nome}
                        {a.quantidade != null ? ` · ${fmtQ(a.quantidade)} ${a.unidade || ''}` : ''}
                      </p>
                      <p className="text-[10.5px] font-bold mt-0.5"
                        style={{ color: atrasado ? '#dc2626' : ehHoje ? '#ea580c' : '#2563eb' }}>
                        {atrasado ? `Atrasado · ${fmtDiaMes(a.data_prevista)}` : ehHoje ? 'Hoje' : fmtDiaMes(a.data_prevista)}
                      </p>
                    </button>
                    <button onClick={() => concluir(a)} disabled={concluindo === a.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-bold text-white flex-shrink-0 disabled:opacity-50"
                      style={{ background: BRAND }}>
                      {concluindo === a.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} Feito
                    </button>
                  </div>
                );
              })}
            </Secao>

            {/* ── 3. Avisos reais ── */}
            {(estoqueBaixo.length > 0 || parcelas.length > 0) && (
              <div className="grid gap-2 mb-5">
                {estoqueBaixo.length > 0 && (
                  <Aviso cor="#b45309" fundo="#fffbeb" borda="#fde68a" Icon={Package} onClick={onGoEstoque}
                    titulo={`${estoqueBaixo.length} ${estoqueBaixo.length > 1 ? 'itens' : 'item'} com estoque baixo`}
                    sub={estoqueBaixo.slice(0, 3).map(i => `${i.nome} (${fmtQ(i.quantidade)} ${i.unidade})`).join(' · ')} />
                )}
                {parcelas.length > 0 && (
                  <Aviso cor="#1d4ed8" fundo="#eff6ff" borda="#bfdbfe" Icon={Wallet} onClick={onGoCompradores}
                    titulo={`${fmtBRL(totalReceber)} a receber`}
                    sub={`${parcelas.length} parcela(s) vencida(s) ou nos próximos 7 dias`} />
                )}
              </div>
            )}

            {/* ── 4. Lotes ── */}
            <Secao titulo="Lotes" extra={`${lotes.length}`} acao={{ lbl: '+ Novo', onClick: onAddLote }}>
              {lotes.map((l, i) => (
                <LoteLinha key={l.id} lote={l} ultimo={ultimoPorLote[l.id]} ultima={i === lotes.length - 1}
                  prop={variasProps ? nomeProp(l.propriedade_id) : null} onClick={() => onSelectLote(l)} />
              ))}
            </Secao>

            {/* ── 5. Últimos registros ── */}
            {recentes.length > 0 && (
              <Secao titulo="Últimos registros">
                {recentes.map((a, i) => {
                  const l = lotePorId[a.plantio_id];
                  const c = getCategoria(a.categoria);
                  return (
                    <button key={a.id} onClick={() => anotar({ editar: a })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      style={{ borderBottom: i < recentes.length - 1 ? '1px solid hsl(140 13% 93%)' : 'none' }}>
                      <span className="text-[16px] flex-shrink-0">{c.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-foreground truncate">{a.etapa}</p>
                        <p className="text-[10.5px] text-muted-foreground truncate">
                          {CULTURAS[l.cultura_id]?.emoji} {l.nome}
                          {a.quantidade != null ? ` · ${fmtQ(a.quantidade)} ${a.unidade || ''}` : ''}
                        </p>
                      </div>
                      <span className="text-[10.5px] font-bold text-muted-foreground flex-shrink-0">{fmtDiaMes(dataDoLancamento(a))}</span>
                    </button>
                  );
                })}
              </Secao>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Peças ────────────────────────────────────────────────────────────────────

function Secao({ titulo, extra, acao, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="section-label">{titulo}{extra ? ` · ${extra}` : ''}</p>
        {acao?.onClick && (
          <button onClick={acao.onClick} className="text-[11.5px] font-bold" style={{ color: BRAND }}>{acao.lbl}</button>
        )}
      </div>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
}

function Aviso({ cor, fundo, borda, Icon, titulo, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
      style={{ background: fundo, border: `1px solid ${borda}` }}>
      <Icon size={18} style={{ color: cor }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold" style={{ color: cor }}>{titulo}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <ChevronRight size={15} style={{ color: cor }} />
    </button>
  );
}

function LoteLinha({ lote, ultimo, ultima, prop, onClick }) {
  const c = CULTURAS[lote.cultura_id];
  if (!c) return null;
  let lc = null;
  try { lc = resolveLifecycle(lote, c); } catch { /* data inválida */ }
  const fase = lc?.faseAtual;
  const faseCor = fase ? getFaseColor(lc.faseIndex) : null;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.02]"
      style={{ borderBottom: ultima ? 'none' : '1px solid hsl(140 13% 93%)', borderLeft: `3px solid ${c.cor}` }}>
      <span className="text-[22px] flex-shrink-0">{c.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-foreground truncate">{lote.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {lc && !lc.dataInvalida ? `Dia ${lc.diasDecorridos}` : ''}
          {fase ? <span style={{ color: faseCor?.text || faseCor }}> · {typeof fase === 'string' ? fase : fase.nome || ''}</span> : null}
          {lc?.prontoParaColheita ? ' · 🌾 em colheita' : ''}
          {prop ? ` · ${prop}` : ''}
        </p>
        <p className="text-[10.5px] text-muted-foreground/90 truncate mt-0.5">
          {ultimo ? `Último: ${ultimo.etapa} · ${fmtDiaMes(dataDoLancamento(ultimo))}` : 'Nenhum registro ainda'}
        </p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
    </button>
  );
}
