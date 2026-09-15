/**
 * TabCronograma.jsx — Cronograma do lote como LANÇAMENTO do produtor.
 *
 * Não há mais plano pré-definido pelo sistema: tudo o que aparece aqui foi
 * inserido pelo usuário, e cada lançamento é AGENDADO (vai fazer) ou
 * REALIZADO (já fez). Um agendado pode ser concluído depois.
 *
 * Integrações preservadas: baixa no estoque quando o lançamento usa um insumo,
 * e fotos guardadas no Storage privado (referência em atividade_fotos).
 * O guia da cultura continua disponível, mas como CONSULTA (aba Guia).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Plus, Trash2, Pencil, Check, X, CalendarDays,
  CalendarClock, ImagePlus, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  CATEGORIAS_ATIVIDADE, getCategoria, STATUS, dataDoLancamento,
  loadAtividades, addAtividade, updateAtividade, concluirAtividade,
  reabrirAtividade, deleteAtividade, loadFotos, uploadFoto, deleteFoto,
} from '../../hooks/useAtividades';
import { loadEstoque, addMovimento, deleteMovimentoByCronogramaAtividade } from '../../hooks/useGestao';
import { today, formatDatePtBR, fmtNumber } from './shared';

const LBL = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1';
const INP = 'w-full rounded-xl border px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2';
const inpStyle = (cor) => ({ background: 'hsl(140 14% 96%)', borderColor: 'hsl(140 13% 88%)', '--tw-ring-color': cor });

const formVazio = () => ({
  data: today(),
  agendado: false,
  categoria: CATEGORIAS_ATIVIDADE[0].value,
  etapa: '',
  produto: '',
  insumoId: '',
  quantidade: '',
  unidade: '',
  observacao: '',
});

function TabCronograma({ lote, cultura, cor, canDelete = true }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const toast = useToast();

  const [itens, setItens]       = useState([]);
  const [fotosPor, setFotosPor] = useState({});   // { atividadeId: [fotos] }
  const [estoque, setEstoque]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [form, setForm]         = useState(formVazio());
  const [arquivos, setArquivos] = useState([]);    // fotos escolhidas antes de salvar
  const fileRef = useRef(null);

  const cat = getCategoria(form.categoria);

  // ── Carregamento ──────────────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    setLoading(true);
    const rows = await loadAtividades(lote.id);
    setItens(rows);
    setLoading(false);
    // fotos em paralelo, sem travar a lista
    const pares = await Promise.all(rows.map(async r => [r.id, await loadFotos(r.id)]));
    setFotosPor(Object.fromEntries(pares.filter(([, f]) => f.length)));
  }, [lote.id]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    let cancelado = false;
    loadEstoque(lote.propriedade_id || null)
      .then(r => { if (!cancelado) setEstoque(r); })
      .catch(() => { if (!cancelado) setEstoque([]); });
    return () => { cancelado = true; };
  }, [lote.propriedade_id]);

  // Ao escolher um insumo do estoque, herda nome e unidade
  const escolherInsumo = (id) => {
    const ins = estoque.find(i => String(i.id) === String(id));
    setForm(f => ({
      ...f,
      insumoId: id,
      produto: ins ? ins.nome : f.produto,
      unidade: ins ? (ins.unidade || f.unidade) : f.unidade,
    }));
  };

  const resetar = () => { setForm(formVazio()); setArquivos([]); setEditId(null); if (fileRef.current) fileRef.current.value = ''; };

  // ── Salvar (novo ou edição) ───────────────────────────────────────────────
  const salvar = async () => {
    if (!form.data || (!form.etapa.trim() && !form.produto.trim())) {
      toast.error('Informe a data e um título ou produto.');
      return;
    }
    setSaving(true);
    try {
      let row;
      if (editId) {
        row = await updateAtividade(editId, { ...form, insumoId: form.insumoId || null });
      } else {
        row = await addAtividade({
          ...form,
          plantioId: lote.id,
          culturaId: cultura?.id || lote.cultura_id,
          insumoId: form.insumoId || null,
        });
      }
      if (!row) { toast.error('Não foi possível salvar. Tente novamente.'); return; }

      // Baixa no estoque: só quando REALIZADO, com insumo e quantidade
      const qtd = parseFloat(form.quantidade) || 0;
      if (!editId && !form.agendado && form.insumoId && qtd > 0) {
        await addMovimento({
          insumoId: form.insumoId,
          tipo: 'saida',
          quantidade: qtd,
          observacao: `Cronograma: ${row.etapa}`,
          data: form.data,
          plantioId: lote.id,
          cronogramaAtividadeId: row.id,
        });
      }

      // Fotos escolhidas
      if (arquivos.length) {
        const enviadas = await Promise.all(arquivos.map(f => uploadFoto(row.id, f)));
        if (enviadas.some(x => !x)) toast.warning('Alguma foto não subiu. Você pode tentar de novo.');
      }

      toast.success(editId ? 'Lançamento atualizado!' : form.agendado ? 'Agendado!' : 'Lançamento registrado!');
      resetar();
      await fetch();
    } catch {
      toast.error('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const editar = (a) => {
    setConfirmDelId(null);
    setEditId(a.id);
    setArquivos([]);
    setForm({
      data: dataDoLancamento(a) || today(),
      agendado: a.status === STATUS.AGENDADO,
      categoria: a.categoria || CATEGORIAS_ATIVIDADE[0].value,
      etapa: a.etapa || '',
      produto: a.produto || '',
      insumoId: a.insumo_id || '',
      quantidade: a.quantidade != null ? String(a.quantidade) : '',
      unidade: a.unidade || '',
      observacao: a.observacao || '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const concluir = async (a) => {
    const row = await concluirAtividade(a.id, today());
    if (!row) { toast.error('Não foi possível concluir.'); return; }
    // baixa no estoque ao concluir, se houver insumo
    if (a.insumo_id && a.quantidade > 0) {
      await addMovimento({
        insumoId: a.insumo_id, tipo: 'saida', quantidade: a.quantidade,
        observacao: `Cronograma: ${a.etapa}`, data: today(),
        plantioId: lote.id, cronogramaAtividadeId: a.id,
      });
    }
    toast.success('Concluído!');
    await fetch();
  };

  const reabrir = async (a) => {
    const row = await reabrirAtividade(a.id, dataDoLancamento(a) || today());
    if (!row) { toast.error('Não foi possível reabrir.'); return; }
    await deleteMovimentoByCronogramaAtividade(a.id); // devolve ao estoque
    toast.success('Voltou para agendado.');
    await fetch();
  };

  const excluir = async (a) => {
    await deleteMovimentoByCronogramaAtividade(a.id); // devolve ao estoque
    const ok = await deleteAtividade(a.id);
    if (!ok) { toast.error('Não foi possível excluir.'); return; }
    setItens(prev => prev.filter(x => x.id !== a.id));
    setConfirmDelId(null);
    toast.success('Lançamento excluído.');
  };

  const removerFoto = async (atividadeId, foto) => {
    const ok = await deleteFoto(foto.id, foto.storage_path);
    if (!ok) { toast.error('Não foi possível remover a foto.'); return; }
    setFotosPor(p => ({ ...p, [atividadeId]: (p[atividadeId] || []).filter(f => f.id !== foto.id) }));
  };

  // ── Agrupamento: agendados primeiro (data crescente), histórico depois ────
  const agendados = itens
    .filter(a => a.status === STATUS.AGENDADO)
    .sort((a, b) => (a.data_prevista || '').localeCompare(b.data_prevista || ''));
  const historico = itens
    .filter(a => a.status !== STATUS.AGENDADO)
    .sort((a, b) => (dataDoLancamento(b) || '').localeCompare(dataDoLancamento(a) || ''));

  const hoje = today();

  return (
    <div className="px-4 pt-4" style={{ paddingBottom: SAFE_BOTTOM }}>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Agendados</p>
          <p className="text-[20px] font-black" style={{ color: cor }}>{agendados.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Realizados</p>
          <p className="text-[20px] font-black" style={{ color: cor }}>{historico.length}</p>
        </div>
      </div>

      {/* ── Formulário ── */}
      <p className="section-label mb-3">{editId ? 'Editar lançamento' : 'Novo lançamento'}</p>
      <div className="card p-4 mb-5" style={editId ? { boxShadow: `0 0 0 2px ${cor}55` } : undefined}>
        {editId && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-[12px] font-semibold"
            style={{ background: `${cor}12`, color: cor }}>
            <Pencil size={13} /> Editando um lançamento — altere e salve.
          </div>
        )}

        {/* Agendado x Realizado */}
        <div className="flex gap-2 mb-3">
          {[{ v: false, lbl: 'Já realizei', Icon: CheckCircle2 }, { v: true, lbl: 'Agendar', Icon: CalendarClock }].map(o => (
            <button key={String(o.v)} type="button"
              onClick={() => setForm(f => ({ ...f, agendado: o.v }))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all"
              style={form.agendado === o.v
                ? { background: cor, color: '#fff' }
                : { background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
              <o.Icon size={14} /> {o.lbl}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={LBL}>{form.agendado ? 'Data prevista' : 'Data'}</label>
            <input type="date" value={form.data} className={`${INP} font-semibold`} style={inpStyle(cor)}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
          </div>
          <div>
            <label className={LBL}>Categoria</label>
            <select value={form.categoria} className={`${INP} font-semibold`} style={inpStyle(cor)}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {CATEGORIAS_ATIVIDADE.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className={LBL}>Título do que foi/será feito</label>
          <input type="text" value={form.etapa} placeholder={`Ex: ${cat.label}`} className={`${INP} font-semibold`} style={inpStyle(cor)}
            onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))} />
        </div>

        {/* Insumo do estoque + produto */}
        {cat.usaInsumo && (
          <>
            {estoque.length > 0 && (
              <div className="mb-3">
                <label className={LBL}>Insumo do estoque (opcional — dá baixa)</label>
                <select value={form.insumoId} className={INP} style={inpStyle(cor)}
                  onChange={e => escolherInsumo(e.target.value)}>
                  <option value="">Não vincular ao estoque</option>
                  {estoque.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nome} — {fmtNumber(i.quantidade)} {i.unidade}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LBL}>Produto</label>
                <input type="text" value={form.produto} placeholder="Ex: MAP 11-52" className={INP} style={inpStyle(cor)}
                  onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} />
              </div>
              <div>
                <label className={LBL}>Quantidade</label>
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" value={form.quantidade} placeholder="0"
                    className={`${INP} font-semibold`} style={inpStyle(cor)}
                    onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                  <input type="text" value={form.unidade} placeholder="un"
                    className="w-[64px] rounded-xl border px-2 py-2.5 text-[13px] font-bold text-center focus:outline-none focus:ring-2"
                    style={{ ...inpStyle(cor), color: cor }}
                    onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mb-3">
          <label className={LBL}>Observação (opcional)</label>
          <textarea rows={2} value={form.observacao} placeholder="Como foi, condições, quem fez…"
            className={`${INP} resize-none`} style={inpStyle(cor)}
            onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>

        {/* Fotos */}
        <div className="mb-4">
          <label className={LBL}>Fotos (opcional)</label>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold border border-dashed"
            style={{ background: `${cor}08`, borderColor: `${cor}55`, color: cor }}>
            <ImagePlus size={15} /> {arquivos.length ? `${arquivos.length} foto(s) escolhida(s)` : 'Adicionar fotos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={e => setArquivos([...(e.target.files || [])])} />
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {arquivos.map((f, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1"
                  style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 35%)' }}>
                  {f.name.slice(0, 18)}
                  <button type="button" onClick={() => setArquivos(a => a.filter((_, j) => j !== i))}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {editId ? (
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={salvar} disabled={saving}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: cor }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar alterações
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={resetar} disabled={saving}
              className="px-4 py-3 rounded-xl text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
              <X size={15} /> Cancelar
            </motion.button>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={salvar} disabled={saving}
            className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: cor }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {form.agendado ? 'Agendar' : 'Registrar'}
          </motion.button>
        )}
      </div>

      {/* ── Listas ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Secao titulo="Agendados" vazio="Nada agendado ainda." itens={agendados} cor={cor}
            fotosPor={fotosPor} hoje={hoje} canDelete={canDelete}
            confirmDelId={confirmDelId} setConfirmDelId={setConfirmDelId}
            onEditar={editar} onExcluir={excluir} onConcluir={concluir} onRemoverFoto={removerFoto} />

          <Secao titulo="Histórico (realizado)" vazio="Nenhum lançamento registrado ainda." itens={historico} cor={cor}
            fotosPor={fotosPor} hoje={hoje} canDelete={canDelete}
            confirmDelId={confirmDelId} setConfirmDelId={setConfirmDelId}
            onEditar={editar} onExcluir={excluir} onReabrir={reabrir} onRemoverFoto={removerFoto} />
        </>
      )}
    </div>
  );
}

// ── Seção de lista ──────────────────────────────────────────────────────────
function Secao({ titulo, vazio, itens, cor, fotosPor, hoje, canDelete,
                confirmDelId, setConfirmDelId, onEditar, onExcluir, onConcluir, onReabrir, onRemoverFoto }) {
  return (
    <div className="mb-6">
      <p className="section-label mb-3">{titulo}</p>
      {itens.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDays size={28} className="mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-[12.5px] text-muted-foreground">{vazio}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {itens.map(a => {
              const c = getCategoria(a.categoria);
              const data = dataDoLancamento(a);
              const atrasado = a.status === STATUS.AGENDADO && data && data < hoje;
              const fotos = fotosPor[a.id] || [];
              return (
                <motion.div key={a.id} layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${cor}18`, color: cor }}>
                          {data ? formatDatePtBR(data) : '—'}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                          {c.emoji} {c.label}
                        </span>
                        {atrasado && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fee2e2', color: '#dc2626' }}>atrasado</span>
                        )}
                      </div>
                      <p className="text-[13.5px] font-bold text-foreground">{a.etapa}</p>
                      {(a.produto || a.quantidade != null) && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {a.produto}
                          {a.quantidade != null && (
                            <> · <strong className="text-foreground">{fmtNumber(a.quantidade)} {a.unidade || ''}</strong></>
                          )}
                          {a.insumo_id && <span className="ml-1 opacity-70">(estoque)</span>}
                        </p>
                      )}
                      {a.observacao && <p className="text-[11.5px] text-muted-foreground mt-1">{a.observacao}</p>}

                      {fotos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {fotos.map(f => (
                            <div key={f.id} className="relative">
                              <a href={f.url} target="_blank" rel="noreferrer">
                                <img src={f.url} alt="" loading="lazy"
                                  className="w-16 h-16 object-cover rounded-lg border"
                                  style={{ borderColor: 'hsl(140 13% 88%)' }} />
                              </a>
                              {canDelete && (
                                <button onClick={() => onRemoverFoto(a.id, f)}
                                  aria-label="Remover foto"
                                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                                  style={{ background: '#dc2626' }}>
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    {canDelete && (
                      confirmDelId === a.id ? (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => onExcluir(a)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-600">Confirmar</button>
                          <button onClick={() => setConfirmDelId(null)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center flex-shrink-0">
                          <button onClick={() => onEditar(a)} aria-label="Editar"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-500">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDelId(a.id)} aria-label="Excluir"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {/* Concluir / Reabrir */}
                  {a.status === STATUS.AGENDADO && onConcluir && (
                    <button onClick={() => onConcluir(a)}
                      className="w-full mt-3 py-2 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-1.5"
                      style={{ background: cor }}>
                      <CheckCircle2 size={14} /> Marcar como realizado
                    </button>
                  )}
                  {a.status !== STATUS.AGENDADO && onReabrir && (
                    <button onClick={() => onReabrir(a)}
                      className="w-full mt-3 py-2 rounded-xl text-[11.5px] font-bold flex items-center justify-center gap-1.5"
                      style={{ background: 'hsl(140 14% 94%)', color: 'hsl(150 8% 40%)' }}>
                      <RotateCcw size={13} /> Voltar para agendado
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default TabCronograma;
