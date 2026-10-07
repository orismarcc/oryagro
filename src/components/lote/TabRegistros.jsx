/**
 * TabRegistros.jsx — tudo o que foi feito (e o que está agendado) no lote.
 *
 * Substitui as antigas abas Cronograma, Caderno e Diário: é uma lista só,
 * filtrável por tipo, com:
 *  - agendados no topo e "✓ Feito" em um toque (baixa no estoque junto);
 *  - histórico agrupado por mês, compacto, com fotos;
 *  - Caderno de campo em PDF gerado a partir dos próprios registros.
 * Criar/editar acontece no "Anotar" (folha única do app).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Plus, CheckCircle2, MoreHorizontal, Pencil, Trash2, RotateCcw, FileDown, X,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAnotar } from '../../context/AnotarContext';
import {
  getCategoria, STATUS, dataDoLancamento, hojeLocalISO, loadAtividades, loadFotosPorAtividades,
  concluirLancamento, reabrirLancamento, excluirLancamento, deleteFoto,
} from '../../hooks/useAtividades';
import { loadEstoque } from '../../hooks/useGestao';
import { supabase } from '../../lib/supabase';
import { formatDatePtBR, fmtNumber } from './shared';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Agrupa os filtros em poucos botões — o produtor pensa em "adubação", não em 3 tipos. */
const FILTROS = [
  { v: 'todos',     lbl: 'Tudo' },
  { v: 'adubacao',  lbl: '🧪 Adubação', cats: ['adubacao_solo', 'fertirrigacao', 'adubacao_foliar'] },
  { v: 'defensivo', lbl: '🛡️ Defensivos', cats: ['defensivo'] },
  { v: 'manejo',    lbl: '✂️ Manejo', cats: ['irrigacao', 'plantio', 'poda', 'solo'] },
  { v: 'outros',    lbl: '📝 Outros', cats: ['colheita', 'monitoramento', 'anotacao', 'outros'] },
];

export default function TabRegistros({ lote, cultura, propriedade = null, cor, canDelete = true }) {
  const toast = useToast();
  const { anotar, versao, avisarMudanca } = useAnotar();
  const [itens, setItens]       = useState([]);
  const [fotosPor, setFotosPor] = useState({});
  const [estoque, setEstoque]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState('todos');
  const [menuId, setMenuId]     = useState(null);
  const [ocupado, setOcupado]   = useState(null);
  const [gerando, setGerando]   = useState(false);
  const hoje = hojeLocalISO();

  const carregar = useCallback(async () => {
    const rows = await loadAtividades(lote.id);
    setItens(rows);
    setLoading(false);
    setFotosPor(await loadFotosPorAtividades(rows.map(r => r.id)));
  }, [lote.id]);

  useEffect(() => { carregar(); }, [carregar, versao]);
  useEffect(() => {
    loadEstoque(null).then(r => setEstoque(r || [])).catch(() => {});
  }, [versao]);

  const filtroObj = FILTROS.find(f => f.v === filtro);
  const visiveis = filtroObj?.cats ? itens.filter(a => filtroObj.cats.includes(a.categoria || 'outros')) : itens;

  const agendados = visiveis
    .filter(a => a.status === STATUS.AGENDADO)
    .sort((a, b) => (a.data_prevista || '').localeCompare(b.data_prevista || ''));
  const feitos = visiveis
    .filter(a => a.status !== STATUS.AGENDADO)
    .sort((a, b) => (dataDoLancamento(b) || '').localeCompare(dataDoLancamento(a) || ''));

  // Histórico agrupado por mês
  const porMes = useMemo(() => {
    const g = [];
    feitos.forEach(a => {
      const d = dataDoLancamento(a) || '';
      const chave = d.slice(0, 7);
      let grupo = g[g.length - 1];
      if (!grupo || grupo.chave !== chave) {
        const [y, m] = chave.split('-');
        grupo = { chave, titulo: m ? `${MESES[parseInt(m, 10) - 1]} ${y}` : 'Sem data', itens: [] };
        g.push(grupo);
      }
      grupo.itens.push(a);
    });
    return g;
  }, [feitos]);

  const acao = async (a, fn, okMsg) => {
    setOcupado(a.id);
    setMenuId(null);
    try {
      const r = await fn();
      if (!r) { toast.error('Não foi possível concluir a ação.'); return; }
      toast.success(okMsg);
      avisarMudanca();
    } finally {
      setOcupado(null);
    }
  };

  const concluir = (a) => acao(a, () => concluirLancamento(a, hoje, estoque), 'Feito! ✓');
  const reabrir  = (a) => acao(a, () => reabrirLancamento(a), 'Voltou para agendado.');
  const excluir  = (a) => {
    if (!window.confirm(`Excluir "${a.etapa}"? O estoque usado volta para o saldo.`)) return;
    acao(a, () => excluirLancamento(a), 'Registro excluído.');
  };
  const removerFoto = async (atividadeId, foto) => {
    if (!window.confirm('Remover esta foto?')) return;
    const ok = await deleteFoto(foto.id, foto.storage_path);
    if (!ok) { toast.error('Não foi possível remover a foto.'); return; }
    setFotosPor(p => ({ ...p, [atividadeId]: (p[atividadeId] || []).filter(f => f.id !== foto.id) }));
  };

  // Caderno de campo (PDF) a partir dos registros realizados com produto
  const gerarCaderno = async () => {
    const aplicacoes = itens
      .filter(a => a.status === STATUS.REALIZADO && a.produto && a.produto !== '—')
      .sort((a, b) => (a.data_execucao || '').localeCompare(b.data_execucao || ''))
      .map(a => {
        const c = getCategoria(a.categoria);
        return {
          data: a.data_execucao,
          tipo: `${c.emoji} ${c.label}`,
          produto: a.produto,
          dose: a.quantidade != null ? `${fmtNumber(a.quantidade)} ${a.unidade || ''}`.trim() : (a.dose || null),
          equipamento: a.forma_aplicacao || null,
          area_ha: lote.area_ha || null,
          obs: [a.etapa !== a.produto ? a.etapa : null, a.observacao].filter(Boolean).join(' — ') || null,
        };
      });
    if (!aplicacoes.length) { toast.info('Nenhum registro com produto para o caderno.'); return; }
    setGerando(true);
    try {
      const { gerarCadernoCampoPDF } = await import('../../lib/cadernoCampoPdf');
      let produtor = '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        produtor = user?.user_metadata?.nome || user?.email || '';
      } catch { /* offline */ }
      gerarCadernoCampoPDF({ lote, cultura, propriedade, aplicacoes, produtor });
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const contagem = (f) => (f.cats ? itens.filter(a => f.cats.includes(a.categoria || 'outros')).length : itens.length);

  return (
    <div className="px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }}>

      {/* Ação principal */}
      <div className="flex gap-2 mb-4">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => anotar({ loteId: lote.id })}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-extrabold text-white"
          style={{ background: cor, boxShadow: `0 10px 20px -12px ${cor}` }}>
          <Plus size={18} /> Anotar neste lote
        </motion.button>
        <button onClick={gerarCaderno} disabled={gerando} title="Caderno de campo (PDF)"
          className="px-3.5 rounded-2xl flex flex-col items-center justify-center text-[9.5px] font-bold border disabled:opacity-50"
          style={{ borderColor: 'hsl(140 13% 86%)', color: 'hsl(150 8% 35%)', background: '#fff' }}>
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          Caderno
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
        {FILTROS.map(f => {
          const n = contagem(f);
          if (f.cats && !n) return null;
          const on = filtro === f.v;
          return (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold border"
              style={on
                ? { background: cor, borderColor: cor, color: '#fff' }
                : { background: '#fff', borderColor: 'hsl(140 13% 87%)', color: 'hsl(150 8% 35%)' }}>
              {f.lbl} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[28px] mb-1">📝</p>
          <p className="text-[14px] font-bold text-foreground">Nada anotado ainda</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Toque em <strong>Anotar</strong> para registrar uma adubação, aplicação, poda… ou agendar o que vai fazer.
          </p>
        </div>
      ) : (
        <>
          {/* Agendados */}
          {agendados.length > 0 && (
            <div className="mb-5">
              <p className="section-label mb-2">📅 Agendados ({agendados.length})</p>
              <div className="card overflow-hidden">
                {agendados.map((a, i) => (
                  <Linha key={a.id} a={a} cor={cor} hoje={hoje} ultima={i === agendados.length - 1}
                    fotos={fotosPor[a.id]} ocupado={ocupado === a.id} canDelete={canDelete}
                    menuAberto={menuId === a.id} onMenu={() => setMenuId(menuId === a.id ? null : a.id)}
                    onConcluir={() => concluir(a)} onEditar={() => { setMenuId(null); anotar({ editar: a }); }}
                    onExcluir={() => excluir(a)} onRemoverFoto={(f) => removerFoto(a.id, f)} />
                ))}
              </div>
            </div>
          )}

          {/* Histórico por mês */}
          {porMes.map(g => (
            <div key={g.chave} className="mb-5">
              <p className="section-label mb-2 capitalize">{g.titulo} · {g.itens.length}</p>
              <div className="card overflow-hidden">
                {g.itens.map((a, i) => (
                  <Linha key={a.id} a={a} cor={cor} hoje={hoje} ultima={i === g.itens.length - 1}
                    fotos={fotosPor[a.id]} ocupado={ocupado === a.id} canDelete={canDelete}
                    menuAberto={menuId === a.id} onMenu={() => setMenuId(menuId === a.id ? null : a.id)}
                    onEditar={() => { setMenuId(null); anotar({ editar: a }); }}
                    onReabrir={() => reabrir(a)} onExcluir={() => excluir(a)}
                    onRemoverFoto={(f) => removerFoto(a.id, f)} />
                ))}
              </div>
            </div>
          ))}
          {!agendados.length && !porMes.length && (
            <p className="text-center text-[12px] text-muted-foreground py-8">Nenhum registro neste filtro.</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Linha compacta de registro ───────────────────────────────────────────────
function Linha({ a, cor, hoje, ultima, fotos = [], ocupado, canDelete, menuAberto, onMenu,
                 onConcluir, onEditar, onReabrir, onExcluir, onRemoverFoto }) {
  const c = getCategoria(a.categoria);
  const data = dataDoLancamento(a);
  const agendado = a.status === STATUS.AGENDADO;
  const atrasado = agendado && data && data < hoje;
  const qtd = a.quantidade != null ? `${fmtNumber(Number(a.quantidade))} ${a.unidade || ''}`.trim() : null;
  const detalhe = [a.produto && a.produto !== a.etapa ? a.produto : null, qtd].filter(Boolean).join(' · ');

  return (
    <div className="px-3.5 py-3" style={{ borderBottom: ultima ? 'none' : '1px solid hsl(140 13% 93%)' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] flex-shrink-0"
          style={{ background: agendado ? '#eff6ff' : `${cor}12` }}>
          {c.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-snug">{a.etapa}</p>
          {detalhe && <p className="text-[11.5px] text-muted-foreground leading-snug">{detalhe}</p>}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10.5px] font-bold"
              style={{ color: atrasado ? '#dc2626' : agendado ? '#2563eb' : 'hsl(150 8% 45%)' }}>
              {formatDatePtBR(data)}{atrasado ? ' · atrasado' : ''}
            </span>
            {a.insumo_id && !agendado && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                estoque
              </span>
            )}
          </div>
          {a.observacao && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{a.observacao}</p>}
          {fotos?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {fotos.map(f => (
                <div key={f.id} className="relative">
                  <a href={f.url || '#'} target="_blank" rel="noreferrer">
                    <img src={f.url || ''} alt="" loading="lazy" className="w-14 h-14 object-cover rounded-lg border"
                      style={{ borderColor: 'hsl(140 13% 88%)' }} />
                  </a>
                  {canDelete && menuAberto && (
                    <button onClick={() => onRemoverFoto(f)} aria-label="Remover foto"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                      style={{ background: '#dc2626' }}><X size={10} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {ocupado ? (
          <Loader2 size={16} className="animate-spin text-muted-foreground mt-2" />
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            {agendado && onConcluir && (
              <button onClick={onConcluir}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold text-white"
                style={{ background: cor }}>
                <CheckCircle2 size={13} /> Feito
              </button>
            )}
            <button onClick={onMenu} aria-label="Mais ações"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground"
              style={menuAberto ? { background: 'hsl(140 14% 93%)' } : undefined}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        )}
      </div>

      {menuAberto && (
        <div className="flex gap-1.5 mt-2.5 pl-12 flex-wrap">
          <BotaoMenu Icon={Pencil} lbl="Editar" onClick={onEditar} />
          {!agendado && onReabrir && <BotaoMenu Icon={RotateCcw} lbl="Voltar p/ agendado" onClick={onReabrir} />}
          {canDelete && <BotaoMenu Icon={Trash2} lbl="Excluir" onClick={onExcluir} perigo />}
        </div>
      )}
    </div>
  );
}

function BotaoMenu({ Icon, lbl, onClick, perigo }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
      style={perigo ? { background: '#fee2e2', color: '#dc2626' } : { background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 35%)' }}>
      <Icon size={12} /> {lbl}
    </button>
  );
}
