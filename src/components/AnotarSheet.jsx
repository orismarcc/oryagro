/**
 * AnotarSheet.jsx — a ação principal do app, aberta de qualquer tela.
 *
 * Três modos, um formulário curto cada:
 *  - Atividade: adubação, defensivo, poda… (feita ou agendada), em vários
 *    lotes de uma vez, com repetição "a cada N dias até…" e produto do estoque
 *    (a baixa — com conversão g→kg, mL→L — é feita pelo banco);
 *  - Colheita: quanto colheu → vira produção do lote automaticamente;
 *  - Compra: despesa + entrada no estoque, reaproveitando o item existente.
 * Funciona sem sinal: o que não sobe agora vai para a fila e sobe sozinho.
 * Também edita registros de atividade/colheita (modo `editar`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, ImagePlus, Repeat, CheckCircle2, CalendarClock, Package } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { useToast } from '../context/ToastContext';
import {
  CATEGORIAS_ATIVIDADE, getCategoria, STATUS, dataDoLancamento, hojeLocalISO,
  gerarDatas, qtdNaUnidadeDoEstoque, salvarLancamentos, editarLancamento,
} from '../hooks/useAtividades';
import { CATEGORIAS_DESPESA, getUnidade, registrarCompra } from '../hooks/useDespesas';
import { loadEstoque } from '../hooks/useGestao';
import * as safeStorage from '../lib/safeStorage';

const BRAND = 'hsl(156 64% 31%)';
const UNIDADES_DOSE    = ['g', 'kg', 'mL', 'L', 'un'];
const UNIDADES_COLHEITA = ['kg', 'cx', 'un', 't'];
const UNIDADES_COMPRA  = ['kg', 'g', 'L', 'mL', 'un', 'sc', 't'];
const CATS_ESTOQUE = ['Insumos Agrícolas', 'Embalagem e Comercialização'];
const LS_ULTIMOS = 'anotar_ultimos_lotes';

const MODOS = [
  { v: 'atividade', lbl: '📝 Atividade' },
  { v: 'colheita',  lbl: '🌾 Colheita' },
  { v: 'compra',    lbl: '🛒 Compra' },
];

const LBL = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5';
const INP = 'w-full rounded-xl border px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2';
const INP_STYLE = { background: 'hsl(140 14% 97%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': BRAND };
const CAIXA = { background: 'hsl(140 14% 97%)', border: '1px solid hsl(140 13% 91%)' };

const ontemISO = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const fmtQ = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtBRL = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formVazio = () => ({
  agendado: false,
  data: hojeLocalISO(),
  categoria: 'adubacao_solo',
  etapa: '',
  produto: '',
  insumoId: '',
  quantidade: '',
  unidade: 'g',
  observacao: '',
  // compra
  catDespesa: 'Insumos Agrícolas',
  subcatDespesa: '',
  valor: '',
  entradaEstoque: true,
});

export default function AnotarSheet({
  open, onClose, lotes: todosLotes = [], loteInicialId = null, editar = null,
  agendadoInicial = false, dataInicial = null, preenchido = null, aberturaId = 0, onSaved,
}) {
  const toast = useToast();
  const fileRef = useRef(null);
  const editando = !!editar;
  // Para anotar, só lotes ativos; para editar, qualquer um (inclusive concluído).
  const lotes = useMemo(
    () => (editar ? todosLotes : todosLotes.filter(l => !l.status || l.status === 'ativo')),
    [todosLotes, editar],
  );

  const [modo, setModo]       = useState('atividade');
  const [selIds, setSelIds]   = useState([]);
  const [form, setForm]       = useState(formVazio());
  const [repetir, setRepetir] = useState({ ativo: false, intervaloDias: 7, ate: '' });
  const [arquivos, setArquivos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [saving, setSaving]   = useState(false);

  // ── Ao abrir: prepara o formulário ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setArquivos([]);
    setRepetir({ ativo: false, intervaloDias: 7, ate: '' });
    if (editar) {
      setModo(editar.categoria === 'colheita' ? 'colheita' : 'atividade');
      setSelIds([editar.plantio_id]);
      setForm({
        ...formVazio(),
        agendado: editar.status === STATUS.AGENDADO,
        data: dataDoLancamento(editar) || hojeLocalISO(),
        categoria: editar.categoria || 'outros',
        etapa: editar.etapa || '',
        produto: editar.produto || '',
        insumoId: editar.insumo_id || '',
        quantidade: editar.quantidade != null ? String(editar.quantidade) : '',
        unidade: editar.unidade || (editar.categoria === 'colheita' ? 'kg' : 'g'),
        observacao: editar.observacao || '',
      });
      return;
    }
    setModo(preenchido?.categoria === 'colheita' ? 'colheita' : 'atividade');
    setForm({
      ...formVazio(),
      agendado: !!agendadoInicial,
      ...(dataInicial ? { data: dataInicial } : {}),
      ...(preenchido || {}),
      ...(preenchido?.categoria === 'colheita' ? { unidade: 'kg' } : {}),
    });
    if (loteInicialId) { setSelIds([loteInicialId]); return; }
    const ultimos = safeStorage.getJSON(LS_ULTIMOS, []) || [];
    const validos = ultimos.filter(id => lotes.some(l => l.id === id));
    setSelIds(validos.length ? validos : (lotes.length === 1 ? [lotes[0].id] : []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aberturaId]);

  // Estoque do usuário (todas as propriedades; filtrado pelos lotes escolhidos)
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    loadEstoque(null).then(r => { if (!cancel) setEstoque(r || []); }).catch(() => {});
    return () => { cancel = true; };
  }, [open]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const hoje = hojeLocalISO();
  const ehCompra = modo === 'compra';
  const ehColheita = modo === 'colheita';

  // Compra é de UM lote (ou da propriedade, sem lote)
  const trocarModo = (m) => {
    if (m === modo) return;
    setModo(m);
    if (m === 'colheita') set({ unidade: 'kg', insumoId: '', produto: '' });
    if (m === 'atividade') set({ unidade: 'g', categoria: form.categoria === 'colheita' ? 'adubacao_solo' : form.categoria });
    if (m === 'compra') {
      set({ unidade: 'kg', agendado: false, insumoId: '' });
      setSelIds(s => s.slice(0, 1));
      setRepetir(r => ({ ...r, ativo: false }));
    }
  };

  const lotesSel = useMemo(() => lotes.filter(l => selIds.includes(l.id)), [lotes, selIds]);
  // Propriedade da compra: a do lote escolhido ou, sem lote, a única existente.
  const propsDosLotes = [...new Set(lotes.map(l => l.propriedade_id).filter(Boolean))];
  const propriedadeCompra = lotesSel[0]?.propriedade_id || (propsDosLotes.length === 1 ? propsDosLotes[0] : null);
  const propsSel = new Set((ehCompra ? [propriedadeCompra] : lotesSel.map(l => l.propriedade_id)).filter(Boolean));
  const estoqueVisivel = estoque.filter(i => !i.propriedade_id || propsSel.size === 0 || propsSel.has(i.propriedade_id));

  const cat = getCategoria(ehColheita ? 'colheita' : form.categoria);
  // Atividade: mostra produto/quantidade se a categoria usa insumo OU já há algo
  // preenchido (registros antigos) — nada fica escondido.
  const mostraProduto = !ehColheita && (cat.usaInsumo || !!form.produto || !!form.quantidade);
  const insumo = estoque.find(i => String(i.id) === String(form.insumoId)) || null;

  const datas = useMemo(() => (
    editando || ehCompra || !repetir.ativo
      ? [form.data]
      : gerarDatas(form.data, { intervaloDias: repetir.intervaloDias, ate: repetir.ate })
  ), [editando, ehCompra, repetir, form.data]);

  // Prévia do efeito no estoque
  const qtdNoEstoque = insumo && form.quantidade
    ? qtdNaUnidadeDoEstoque(form.quantidade, form.unidade, insumo.unidade)
    : null;
  const incompativel = !!(insumo && form.quantidade && qtdNoEstoque == null);
  const realizadas = form.agendado ? 0 : datas.filter(d => d <= hoje).length;
  const baixaTotal = qtdNoEstoque != null ? qtdNoEstoque * realizadas * Math.max(1, lotesSel.length) : 0;
  const precoUnit = ehCompra && parseFloat(form.valor) > 0 && parseFloat(form.quantidade) > 0
    ? parseFloat(form.valor) / parseFloat(form.quantidade) : null;

  const toggleLote = (id) => {
    if (editando) return;
    if (ehCompra) { setSelIds(s => (s[0] === id ? [] : [id])); return; }
    setSelIds(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };
  const escolherInsumo = (id) => {
    const ins = estoque.find(i => String(i.id) === String(id));
    // Numa aplicação a dose costuma ser em g/mL; numa compra, na unidade do item.
    const unidade = !ins ? form.unidade
      : ehCompra ? ins.unidade
      : ({ kg: 'g', l: 'mL' }[String(ins.unidade).toLowerCase()] || ins.unidade);
    set({ insumoId: id, produto: ins ? ins.nome : form.produto, unidade });
  };

  const avisarResultado = ({ criados, falhas, offline, fotosPendentes }, agendado) => {
    const msg = criados === 1 ? (agendado ? 'Agendado!' : 'Anotado!') : `${criados} registros salvos!`;
    if (falhas) toast.warning(`${msg} (${falhas} não foram salvos — tente de novo)`);
    else toast.success(msg);
    if (offline) toast.info('Sem sinal: ficou salvo no aparelho e sobe sozinho quando a conexão voltar.');
    if (fotosPendentes) toast.warning(`${fotosPendentes} foto(s) não subiram${offline ? ' (sem sinal)' : ''}. Adicione depois em Editar.`);
  };

  const salvarCompra = async () => {
    if (!form.produto.trim() && !form.insumoId) { toast.error('Informe o produto comprado.'); return; }
    if (!(parseFloat(form.valor) > 0)) { toast.error('Informe o valor pago.'); return; }
    if (!propriedadeCompra) { toast.error('Escolha o lote da compra.'); return; }
    const r = await registrarCompra({
      plantioId: lotesSel[0]?.id || null,
      propriedadeId: propriedadeCompra,
      data: form.data,
      categoria: form.catDespesa,
      subcategoria: form.subcatDespesa,
      produto: form.produto.trim(),
      quantidade: form.quantidade,
      unidade: form.unidade,
      valor: form.valor,
      observacao: form.observacao,
      entradaEstoque: form.entradaEstoque && CATS_ESTOQUE.includes(form.catDespesa),
      insumoId: form.insumoId || null,
      estoque: estoqueVisivel,
    });
    if (!r.ok) {
      toast.error(r.motivo === 'unidade'
        ? `${form.unidade} não converte para ${r.unidadeEstoque}, a unidade do item no estoque.`
        : 'Não foi possível salvar a compra. Tente novamente.');
      return false;
    }
    toast.success('Compra registrada!');
    if (r.offline) toast.info('Sem sinal: ficou salva no aparelho e sobe sozinha quando a conexão voltar.');
    return true;
  };

  const salvar = async () => {
    if (!ehCompra && !lotesSel.length) { toast.error('Escolha pelo menos um lote.'); return; }
    if (!form.data) { toast.error('Informe a data.'); return; }
    if (!datas.length) { toast.error('Confira a repetição: a data final deve ser depois da inicial.'); return; }
    if (ehColheita && !form.agendado && !(parseFloat(form.quantidade) > 0)) {
      toast.error('Informe quanto colheu.'); return;
    }
    setSaving(true);
    try {
      if (ehCompra) {
        if (!(await salvarCompra())) return;
      } else {
        const payload = {
          ...form,
          categoria: ehColheita ? 'colheita' : form.categoria,
          etapa: (form.etapa.trim() || (ehColheita ? 'Colheita' : form.produto.trim()) || cat.label),
          produto: ehColheita ? '' : form.produto.trim(),
          insumoId: mostraProduto ? form.insumoId : '',
          unidade: form.quantidade ? form.unidade : '',
        };
        if (editando) {
          const r = await editarLancamento(editar.id, payload, { arquivos });
          if (!r.ok) { toast.error('Não foi possível salvar. Tente novamente.'); return; }
          toast.success('Registro atualizado!');
          if (r.offline) toast.info('Sem sinal: a alteração sobe quando a conexão voltar.');
          if (r.fotosPendentes) toast.warning(`${r.fotosPendentes} foto(s) não subiram.`);
        } else {
          const r = await salvarLancamentos({ lotes: lotesSel, form: payload, datas, arquivos, hojeISO: hoje });
          if (!r.criados) { toast.error('Não foi possível salvar. Tente novamente.'); return; }
          safeStorage.setJSON(LS_ULTIMOS, selIds);
          avisarResultado(r, payload.agendado);
        }
      }
      onSaved?.();
      onClose?.();
    } catch {
      toast.error('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const nLotes = Math.max(1, lotesSel.length);
  const total = datas.length * nLotes;
  const textoBotao = editando ? 'Salvar alterações'
    : ehCompra ? 'Registrar compra'
    : total > 1
      ? `${form.agendado ? 'Agendar' : 'Registrar'} ${total} (${nLotes} lote${nLotes > 1 ? 's' : ''} × ${datas.length} data${datas.length > 1 ? 's' : ''})`
      : (form.agendado ? 'Agendar' : ehColheita ? 'Registrar colheita' : 'Registrar');

  const subcats = CATEGORIAS_DESPESA.find(c => c.label === form.catDespesa)?.subcategorias || [];
  const unidades = ehColheita ? UNIDADES_COLHEITA : ehCompra ? UNIDADES_COMPRA : UNIDADES_DOSE;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !saving && onClose?.()}
            className="fixed inset-0 z-[80]" style={{ background: 'rgba(0,0,0,0.4)' }} />
          <motion.div key="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[90] mx-auto flex flex-col rounded-t-3xl bg-white"
            style={{ maxWidth: 640, maxHeight: '94dvh' }}
            role="dialog" aria-label={editando ? 'Editar registro' : 'Anotar'}>

            {/* Cabeçalho */}
            <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'hsl(140 13% 92%)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[17px] font-extrabold text-foreground leading-tight">
                  {editando ? 'Editar registro' : 'Anotar'}
                </p>
                <button onClick={() => !saving && onClose?.()} aria-label="Fechar"
                  className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'hsl(140 14% 94%)' }}>
                  <X size={17} />
                </button>
              </div>
              {!editando && (
                <div className="flex gap-1 p-1 mt-2.5 rounded-xl" style={{ background: 'hsl(140 14% 94%)' }}>
                  {MODOS.map(m => (
                    <button key={m.v} type="button" onClick={() => trocarModo(m.v)}
                      className="flex-1 py-2 rounded-lg text-[12.5px] font-bold transition-all"
                      style={modo === m.v
                        ? { background: '#fff', color: BRAND, boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' }
                        : { color: 'hsl(150 8% 40%)' }}>
                      {m.lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4" style={{ overscrollBehavior: 'contain' }}>

              {/* Lotes */}
              <label className={LBL}>
                {editando ? 'Lote' : ehCompra ? 'Para qual lote? (opcional)' : 'Onde? (pode marcar vários)'}
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {(editando ? lotes.filter(l => selIds.includes(l.id)) : lotes).map(l => {
                  const c = CULTURAS[l.cultura_id];
                  const on = selIds.includes(l.id);
                  const cor = c?.cor || BRAND;
                  return (
                    <button key={l.id} type="button" onClick={() => toggleLote(l.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold border transition-all"
                      style={on
                        ? { background: cor, borderColor: cor, color: '#fff' }
                        : { background: '#fff', borderColor: 'hsl(140 13% 86%)', color: 'hsl(150 8% 30%)' }}>
                      <span>{c?.emoji || '🌱'}</span>
                      <span className="max-w-[230px] truncate">{l.nome}</span>
                      {on && !editando && <Check size={13} />}
                    </button>
                  );
                })}
                {!lotes.length && <p className="text-[12px] text-muted-foreground">Cadastre um lote primeiro.</p>}
              </div>
              {ehCompra && !lotesSel.length && (
                <p className="text-[11px] text-muted-foreground -mt-2 mb-4">Sem lote, a compra fica como despesa geral da propriedade.</p>
              )}

              {/* Feito x Agendar (compra é sempre algo já feito) */}
              {!ehCompra && (
                <div className="flex gap-2 mb-4">
                  {[{ v: false, lbl: ehColheita ? 'Já colhi' : 'Já fiz', Icon: CheckCircle2 }, { v: true, lbl: 'Agendar', Icon: CalendarClock }].map(o => (
                    <button key={String(o.v)} type="button" onClick={() => set({ agendado: o.v })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                      style={form.agendado === o.v
                        ? { background: BRAND, color: '#fff' }
                        : { background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                      <o.Icon size={15} /> {o.lbl}
                    </button>
                  ))}
                </div>
              )}

              {/* Data */}
              <label className={LBL}>{form.agendado ? 'Para quando' : 'Quando'}</label>
              <div className="flex gap-2 mb-4">
                {!form.agendado && [['Hoje', hoje], ['Ontem', ontemISO()]].map(([lbl, iso]) => (
                  <button key={lbl} type="button" onClick={() => set({ data: iso })}
                    className="px-3 rounded-xl text-[12.5px] font-bold border"
                    style={form.data === iso
                      ? { background: `${BRAND}14`, borderColor: BRAND, color: BRAND }
                      : { background: '#fff', borderColor: 'hsl(140 13% 86%)', color: 'hsl(150 8% 35%)' }}>
                    {lbl}
                  </button>
                ))}
                <input type="date" value={form.data} onChange={e => set({ data: e.target.value })}
                  className={`${INP} font-semibold flex-1`} style={INP_STYLE} />
              </div>

              {/* Atividade: categoria */}
              {modo === 'atividade' && (
                <>
                  <label className={LBL}>O que foi feito</label>
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {CATEGORIAS_ATIVIDADE.filter(c => c.value !== 'colheita').map(c => {
                      const on = form.categoria === c.value;
                      return (
                        <button key={c.value} type="button" onClick={() => set({ categoria: c.value })}
                          className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-xl border text-center transition-all"
                          style={on
                            ? { background: `${BRAND}12`, borderColor: BRAND }
                            : { background: '#fff', borderColor: 'hsl(140 13% 89%)' }}>
                          <span className="text-[18px] leading-none">{c.emoji}</span>
                          <span className="text-[10px] font-bold leading-tight" style={{ color: on ? BRAND : 'hsl(150 8% 35%)' }}>
                            {c.label.replace(/ \/.*$/, '').replace(' (solo)', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Compra: tipo de despesa */}
              {ehCompra && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label className={LBL}>Tipo de despesa</label>
                    <select value={form.catDespesa}
                      onChange={e => set({ catDespesa: e.target.value, subcatDespesa: '', unidade: getUnidade(e.target.value, '') })}
                      className={INP} style={INP_STYLE}>
                      {CATEGORIAS_DESPESA.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Detalhe</label>
                    <select value={form.subcatDespesa}
                      onChange={e => set({ subcatDespesa: e.target.value, ...(form.insumoId ? {} : { unidade: getUnidade(form.catDespesa, e.target.value) }) })}
                      className={INP} style={INP_STYLE}>
                      <option value="">—</option>
                      {subcats.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Produto + quantidade (atividade com insumo, colheita, compra) */}
              {(mostraProduto || ehColheita || ehCompra) && (
                <div className="rounded-2xl p-3 mb-4" style={CAIXA}>
                  {!ehColheita && estoqueVisivel.length > 0 && (!ehCompra || CATS_ESTOQUE.includes(form.catDespesa)) && (
                    <>
                      <label className={LBL}>
                        <Package size={10} className="inline mr-1" />
                        {ehCompra ? 'Item do estoque (ou digite um novo abaixo)' : 'Produto do estoque (dá baixa)'}
                      </label>
                      <select value={form.insumoId} onChange={e => escolherInsumo(e.target.value)}
                        className={`${INP} mb-2.5`} style={{ ...INP_STYLE, background: '#fff' }}>
                        <option value="">{ehCompra ? '— Produto novo —' : '— Não usar o estoque —'}</option>
                        {estoqueVisivel.map(i => (
                          <option key={i.id} value={i.id}>{i.nome} · {fmtQ(i.quantidade)} {i.unidade}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {!ehColheita && !form.insumoId && (
                    <>
                      <label className={LBL}>{ehCompra ? 'Produto comprado' : 'Produto'}</label>
                      <input type="text" value={form.produto}
                        placeholder={ehCompra ? 'Ex: Sulfato de amônia 21-00-00' : 'Ex: Sulfato de amônia'}
                        onChange={e => set({ produto: e.target.value })}
                        className={`${INP} mb-2.5`} style={{ ...INP_STYLE, background: '#fff' }} />
                    </>
                  )}
                  <label className={LBL}>
                    {ehColheita ? 'Quanto colheu' : ehCompra ? 'Quantidade comprada' : 'Quantidade'}
                    {lotesSel.length > 1 && !ehCompra ? ' (em cada lote)' : ''}
                  </label>
                  <div className="flex gap-2 items-center">
                    <input type="number" inputMode="decimal" min="0" step="any" value={form.quantidade} placeholder="0"
                      onChange={e => set({ quantidade: e.target.value })}
                      className="w-24 flex-shrink-0 rounded-xl border px-3 py-2.5 text-[15px] font-bold focus:outline-none focus:ring-2"
                      style={{ ...INP_STYLE, background: '#fff' }} />
                    <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
                      {unidades.map(u => (
                        <button key={u} type="button" onClick={() => set({ unidade: u })}
                          className="px-2.5 py-2 rounded-lg text-[12px] font-bold border"
                          style={form.unidade === u
                            ? { background: BRAND, borderColor: BRAND, color: '#fff' }
                            : { background: '#fff', borderColor: 'hsl(140 13% 86%)', color: 'hsl(150 8% 35%)' }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  {ehColheita && (
                    <p className="text-[11px] mt-2 text-muted-foreground">Entra na produção do lote (aba Colheita) automaticamente.</p>
                  )}
                  {!ehColheita && insumo && form.quantidade && (
                    <p className="text-[11px] mt-2 font-semibold" style={{ color: incompativel ? '#b45309' : BRAND }}>
                      {incompativel
                        ? `⚠ ${form.unidade} não converte para ${insumo.unidade}: ${ehCompra ? 'escolha uma unidade compatível.' : 'não haverá baixa no estoque.'}`
                        : ehCompra
                          ? `Entrada no estoque: +${fmtQ(qtdNoEstoque)} ${insumo.unidade} (saldo ${fmtQ(insumo.quantidade)} → ${fmtQ(Number(insumo.quantidade) + qtdNoEstoque)}).`
                          : form.agendado
                            ? `A baixa de ${fmtQ(qtdNoEstoque)} ${insumo.unidade} por aplicação acontece ao marcar como feito.`
                            : `Baixa no estoque: ${fmtQ(baixaTotal)} ${insumo.unidade} (saldo ${fmtQ(insumo.quantidade)} ${insumo.unidade}).`}
                    </p>
                  )}

                  {ehCompra && (
                    <>
                      <label className={`${LBL} mt-3`}>Valor pago (R$)</label>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} placeholder="0,00"
                        onChange={e => set({ valor: e.target.value })}
                        className={`${INP} font-bold`} style={{ ...INP_STYLE, background: '#fff' }} />
                      {precoUnit != null && (
                        <p className="text-[11px] mt-1.5 font-semibold" style={{ color: BRAND }}>
                          {fmtBRL(precoUnit)} por {form.unidade}
                        </p>
                      )}
                      {CATS_ESTOQUE.includes(form.catDespesa) && (
                        <label className="flex items-center gap-2 mt-3 text-[12.5px] font-semibold text-foreground">
                          <input type="checkbox" checked={form.entradaEstoque}
                            onChange={e => set({ entradaEstoque: e.target.checked })}
                            className="w-4 h-4" style={{ accentColor: BRAND }} />
                          Dar entrada no estoque {form.insumoId ? '' : '(cria o item se não existir)'}
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Título (atividade/colheita) */}
              {!ehCompra && (
                <>
                  <label className={LBL}>Título (opcional)</label>
                  <input type="text" value={form.etapa}
                    placeholder={ehColheita ? 'Colheita' : (form.produto || cat.label)}
                    onChange={e => set({ etapa: e.target.value })}
                    className={`${INP} mb-4`} style={INP_STYLE} />
                </>
              )}

              {/* Repetição */}
              {!editando && !ehCompra && (
                <div className="mb-4">
                  <button type="button" onClick={() => setRepetir(r => ({ ...r, ativo: !r.ativo }))}
                    className="flex items-center gap-2 text-[12.5px] font-bold"
                    style={{ color: repetir.ativo ? BRAND : 'hsl(150 8% 40%)' }}>
                    <span className="w-9 h-5 rounded-full relative transition-colors"
                      style={{ background: repetir.ativo ? BRAND : 'hsl(140 10% 82%)' }}>
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: repetir.ativo ? 18 : 2 }} />
                    </span>
                    <Repeat size={14} /> Repetir
                  </button>
                  {repetir.ativo && (
                    <div className="mt-2.5 rounded-2xl p-3" style={CAIXA}>
                      <div className="flex items-center gap-2 text-[13px] font-semibold flex-wrap">
                        <span>A cada</span>
                        <input type="number" min="1" max="90" value={repetir.intervaloDias}
                          onChange={e => setRepetir(r => ({ ...r, intervaloDias: e.target.value }))}
                          className="w-16 rounded-lg border px-2 py-1.5 text-center font-bold" style={{ ...INP_STYLE, background: '#fff' }} />
                        <span>dias, até</span>
                        <input type="date" value={repetir.ate} min={form.data}
                          onChange={e => setRepetir(r => ({ ...r, ate: e.target.value }))}
                          className="rounded-lg border px-2 py-1.5 font-bold" style={{ ...INP_STYLE, background: '#fff' }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {repetir.ate
                          ? `${datas.length} data(s): ${datas.slice(0, 6).map(fmtBR).join(', ')}${datas.length > 6 ? '…' : ''}`
                          : 'Escolha a data final.'}
                        {!form.agendado && datas.some(d => d > hoje) && ' · Datas futuras ficam como agendadas.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Observação */}
              <label className={LBL}>Observação (opcional)</label>
              <textarea rows={2} value={form.observacao}
                placeholder={ehCompra ? 'Fornecedor, nota fiscal…' : 'Como foi, dose, clima, quem fez…'}
                onChange={e => set({ observacao: e.target.value })}
                className={`${INP} resize-none mb-4`} style={INP_STYLE} />

              {/* Fotos (registros do lote) */}
              {!ehCompra && (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12.5px] font-bold border border-dashed"
                    style={{ background: `${BRAND}08`, borderColor: `${BRAND}55`, color: BRAND }}>
                    <ImagePlus size={16} />
                    {arquivos.length ? `${arquivos.length} foto(s) — trocar` : editando ? 'Adicionar mais fotos' : 'Adicionar fotos'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setArquivos([...(e.target.files || [])])} />
                </>
              )}
            </div>

            {/* Rodapé fixo */}
            <div className="px-5 pt-3 border-t" style={{ borderColor: 'hsl(140 13% 92%)', paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
              <motion.button whileTap={{ scale: 0.98 }} onClick={salvar}
                disabled={saving || (!ehCompra && !lotesSel.length) || (ehCompra && incompativel)}
                className="w-full py-3.5 rounded-2xl text-[14px] font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: BRAND, boxShadow: `0 10px 20px -10px ${BRAND}` }}>
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                {textoBotao}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
