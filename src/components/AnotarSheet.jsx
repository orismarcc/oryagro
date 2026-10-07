/**
 * AnotarSheet.jsx — a ação principal do app: anotar o que foi feito (ou agendar).
 *
 * Um único formulário, aberto de qualquer lugar (botão central da barra, Início,
 * lote). Pensado para poucos toques:
 *  - vários lotes de uma vez (a mesma aplicação no maracujá e na acerola);
 *  - "Hoje"/"Ontem" com um toque;
 *  - repetição ("a cada 7 dias até…") para lançar uma rotina inteira;
 *  - produto do estoque com baixa automática (converte g→kg, mL→L);
 *  - fotos guardadas no Storage privado.
 * Também edita um lançamento existente (modo `editar`).
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
import { loadEstoque } from '../hooks/useGestao';
import * as safeStorage from '../lib/safeStorage';

const BRAND = 'hsl(156 64% 31%)';
const UNIDADES = ['g', 'kg', 'mL', 'L', 'un'];
const LS_ULTIMOS = 'anotar_ultimos_lotes';

const LBL = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5';
const INP = 'w-full rounded-xl border px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2';
const INP_STYLE = { background: 'hsl(140 14% 97%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': BRAND };

const ontemISO = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const fmtQ = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

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
});

export default function AnotarSheet({ open, onClose, lotes: todosLotes = [], loteInicialId = null, editar = null, agendadoInicial = false, dataInicial = null, aberturaId = 0, onSaved }) {
  const toast = useToast();
  // Para anotar, só lotes ativos; para editar, qualquer um (inclusive concluído).
  const lotes = useMemo(
    () => (editar ? todosLotes : todosLotes.filter(l => !l.status || l.status === 'ativo')),
    [todosLotes, editar],
  );
  const fileRef = useRef(null);
  const editando = !!editar;

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
      setSelIds([editar.plantio_id]);
      setForm({
        agendado: editar.status === STATUS.AGENDADO,
        data: dataDoLancamento(editar) || hojeLocalISO(),
        categoria: editar.categoria || 'outros',
        etapa: editar.etapa || '',
        produto: editar.produto || '',
        insumoId: editar.insumo_id || '',
        quantidade: editar.quantidade != null ? String(editar.quantidade) : '',
        unidade: editar.unidade || 'g',
        observacao: editar.observacao || '',
      });
      return;
    }
    setForm({ ...formVazio(), agendado: !!agendadoInicial, ...(dataInicial ? { data: dataInicial } : {}) });
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

  const lotesSel = useMemo(() => lotes.filter(l => selIds.includes(l.id)), [lotes, selIds]);
  const propsSel = new Set(lotesSel.map(l => l.propriedade_id).filter(Boolean));
  const estoqueVisivel = estoque.filter(i => !i.propriedade_id || propsSel.size === 0 || propsSel.has(i.propriedade_id));

  const cat = getCategoria(form.categoria);
  // Mostra produto/quantidade quando a categoria usa insumo OU já há algo
  // preenchido (registros antigos) — assim nada fica escondido.
  const mostraProduto = cat.usaInsumo || !!form.produto || !!form.quantidade;
  const insumo = estoque.find(i => String(i.id) === String(form.insumoId)) || null;

  const datas = useMemo(() => (
    editando || !repetir.ativo
      ? [form.data]
      : gerarDatas(form.data, { intervaloDias: repetir.intervaloDias, ate: repetir.ate })
  ), [editando, repetir, form.data]);

  // Prévia da baixa no estoque
  const baixaPorAplicacao = insumo && form.quantidade
    ? qtdNaUnidadeDoEstoque(form.quantidade, form.unidade, insumo.unidade)
    : null;
  const incompativel = insumo && form.quantidade && baixaPorAplicacao == null;
  const hoje = hojeLocalISO();
  const aplicacoesRealizadas = form.agendado ? 0 : datas.filter(d => d <= hoje).length;
  const baixaTotal = baixaPorAplicacao != null ? baixaPorAplicacao * aplicacoesRealizadas * Math.max(1, lotesSel.length) : 0;

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const toggleLote = (id) => {
    if (editando) return;
    setSelIds(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };
  const escolherInsumo = (id) => {
    const ins = estoque.find(i => String(i.id) === String(id));
    // Ao escolher um item em kg/L, a dose costuma ser em g/mL — sugere a menor.
    const sugerida = ins ? ({ kg: 'g', l: 'mL' }[String(ins.unidade).toLowerCase()] || ins.unidade) : form.unidade;
    set({ insumoId: id, produto: ins ? ins.nome : form.produto, unidade: sugerida || form.unidade });
  };

  const salvar = async () => {
    if (!lotesSel.length) { toast.error('Escolha pelo menos um lote.'); return; }
    if (!form.data) { toast.error('Informe a data.'); return; }
    if (!datas.length) { toast.error('Confira a repetição: a data final deve ser depois da inicial.'); return; }
    // Nada digitado é descartado: produto/quantidade ficam mesmo se a categoria
    // mudar. Só o vínculo com o estoque exige uma categoria que usa insumo.
    const payload = {
      ...form,
      etapa: (form.etapa.trim() || form.produto.trim() || cat.label).slice(0, 200),
      produto: form.produto.trim(),
      insumoId: mostraProduto ? form.insumoId : '',
      unidade: form.quantidade ? form.unidade : '',
    };
    setSaving(true);
    try {
      if (editando) {
        const row = await editarLancamento(editar.id, payload, { arquivos, estoque });
        if (!row) { toast.error('Não foi possível salvar. Tente novamente.'); return; }
        toast.success('Registro atualizado!');
      } else {
        const r = await salvarLancamentos({ lotes: lotesSel, form: payload, datas, arquivos, estoque, hojeISO: hoje });
        if (!r.criados) { toast.error('Não foi possível salvar. Verifique a conexão.'); return; }
        safeStorage.setJSON(LS_ULTIMOS, selIds);
        const msg = r.criados === 1
          ? (payload.agendado ? 'Agendado!' : 'Anotado!')
          : `${r.criados} registros salvos!`;
        if (r.falhas) toast.warning(`${msg} (${r.falhas} falharam — tente de novo)`);
        else toast.success(msg);
        if (r.semBaixa) toast.warning('Unidade diferente da do estoque: a baixa não foi feita.');
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
  const textoBotao = editando
    ? 'Salvar alterações'
    : total > 1
      ? `${form.agendado ? 'Agendar' : 'Registrar'} ${total} (${nLotes} lote${nLotes > 1 ? 's' : ''} × ${datas.length} data${datas.length > 1 ? 's' : ''})`
      : (form.agendado ? 'Agendar' : 'Registrar');

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
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: 'hsl(140 13% 92%)' }}>
              <div>
                <p className="text-[17px] font-extrabold text-foreground leading-tight">
                  {editando ? 'Editar registro' : 'Anotar'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {editando ? 'Altere e salve' : 'O que você fez ou vai fazer'}
                </p>
              </div>
              <button onClick={() => !saving && onClose?.()} aria-label="Fechar"
                className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'hsl(140 14% 94%)' }}>
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4" style={{ overscrollBehavior: 'contain' }}>

              {/* Lotes */}
              <label className={LBL}>{editando ? 'Lote' : 'Onde? (pode marcar vários)'}</label>
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

              {/* Feito x Agendar */}
              <div className="flex gap-2 mb-4">
                {[{ v: false, lbl: 'Já fiz', Icon: CheckCircle2 }, { v: true, lbl: 'Agendar', Icon: CalendarClock }].map(o => (
                  <button key={String(o.v)} type="button" onClick={() => set({ agendado: o.v })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                    style={form.agendado === o.v
                      ? { background: BRAND, color: '#fff' }
                      : { background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                    <o.Icon size={15} /> {o.lbl}
                  </button>
                ))}
              </div>

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

              {/* Categoria */}
              <label className={LBL}>O que foi feito</label>
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {CATEGORIAS_ATIVIDADE.map(c => {
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

              {/* Produto + quantidade */}
              {mostraProduto && (
                <div className="rounded-2xl p-3 mb-4" style={{ background: 'hsl(140 14% 97%)', border: '1px solid hsl(140 13% 91%)' }}>
                  {estoqueVisivel.length > 0 && (
                    <>
                      <label className={LBL}><Package size={10} className="inline mr-1" />Produto do estoque (dá baixa)</label>
                      <select value={form.insumoId} onChange={e => escolherInsumo(e.target.value)}
                        className={`${INP} mb-2.5`} style={{ ...INP_STYLE, background: '#fff' }}>
                        <option value="">— Não usar o estoque —</option>
                        {estoqueVisivel.map(i => (
                          <option key={i.id} value={i.id}>{i.nome} · {fmtQ(i.quantidade)} {i.unidade}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {!form.insumoId && (
                    <>
                      <label className={LBL}>Produto</label>
                      <input type="text" value={form.produto} placeholder="Ex: Sulfato de amônia"
                        onChange={e => set({ produto: e.target.value })}
                        className={`${INP} mb-2.5`} style={{ ...INP_STYLE, background: '#fff' }} />
                    </>
                  )}
                  <label className={LBL}>Quantidade{lotesSel.length > 1 ? ' (em cada lote)' : ''}</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" inputMode="decimal" min="0" step="any" value={form.quantidade} placeholder="0"
                      onChange={e => set({ quantidade: e.target.value })}
                      className="w-24 flex-shrink-0 rounded-xl border px-3 py-2.5 text-[15px] font-bold focus:outline-none focus:ring-2"
                      style={{ ...INP_STYLE, background: '#fff' }} />
                    <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
                      {UNIDADES.map(u => (
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
                  {insumo && form.quantidade && (
                    <p className="text-[11px] mt-2 font-semibold" style={{ color: incompativel ? '#b45309' : BRAND }}>
                      {incompativel
                        ? `⚠ ${form.unidade} não converte para ${insumo.unidade}: não haverá baixa no estoque.`
                        : form.agendado
                          ? `A baixa de ${fmtQ(baixaPorAplicacao)} ${insumo.unidade} por aplicação acontece quando marcar como feito.`
                          : `Baixa no estoque: ${fmtQ(baixaTotal)} ${insumo.unidade} (saldo ${fmtQ(insumo.quantidade)} ${insumo.unidade}).`}
                    </p>
                  )}
                </div>
              )}

              {/* Título */}
              <label className={LBL}>Título (opcional)</label>
              <input type="text" value={form.etapa}
                placeholder={form.produto || cat.label}
                onChange={e => set({ etapa: e.target.value })}
                className={`${INP} mb-4`} style={INP_STYLE} />

              {/* Repetição */}
              {!editando && (
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
                    <div className="mt-2.5 rounded-2xl p-3" style={{ background: 'hsl(140 14% 97%)', border: '1px solid hsl(140 13% 91%)' }}>
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
              <textarea rows={2} value={form.observacao} placeholder="Como foi, dose, clima, quem fez…"
                onChange={e => set({ observacao: e.target.value })}
                className={`${INP} resize-none mb-4`} style={INP_STYLE} />

              {/* Fotos */}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12.5px] font-bold border border-dashed"
                style={{ background: `${BRAND}08`, borderColor: `${BRAND}55`, color: BRAND }}>
                <ImagePlus size={16} />
                {arquivos.length ? `${arquivos.length} foto(s) — trocar` : editando ? 'Adicionar mais fotos' : 'Adicionar fotos'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => setArquivos([...(e.target.files || [])])} />
            </div>

            {/* Rodapé fixo */}
            <div className="px-5 pt-3 border-t" style={{ borderColor: 'hsl(140 13% 92%)', paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
              <motion.button whileTap={{ scale: 0.98 }} onClick={salvar} disabled={saving || !lotesSel.length}
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
