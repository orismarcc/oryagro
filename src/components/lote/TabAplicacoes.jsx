/**
 * TabAplicacoes.jsx — Caderno de Campo de Aplicações (defensivos / adubação).
 *
 * Preenchimento simples no campo: os campos essenciais ficam à vista e os
 * detalhes técnicos exigidos pelo MAPA ficam numa seção expansível. Gera o
 * relatório em PDF de rastreabilidade.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { Plus, Trash2, FileText, Loader2, SprayCan, ChevronDown } from 'lucide-react';
import { useAplicacoes } from '../../hooks/useAplicacoes';
import {
  TIPOS_APLICACAO, CLASSES_APLICACAO, sugerirProduto, classeLabel, tipoLabel,
} from '../../data/defensivos';
import { gerarCadernoCampoPDF } from '../../lib/cadernoCampoPdf';
import { loadEstoque, addMovimento } from '../../hooks/useGestao';
import { matchEstoque } from '../../lib/listaCompras';
import { supabase } from '../../lib/supabase';
import { today, formatDatePtBR } from './shared';

const CLASSE_COR = {
  herbicida: '#b45309', fungicida: '#0369a1', inseticida: '#991b1b',
  acaricida: '#6d28d9', nematicida: '#374151', adubo: '#15803d',
  foliar: '#0d9488', corretivo: '#78716c', outro: '#4b5563',
};

function emptyForm(lote) {
  return {
    data: today(), tipo: 'defensivo', produto: '', ingrediente_ativo: '', classe: '',
    registro_mapa: '', alvo: '', dose: '', area_ha: lote?.area_ha ?? '', volume_calda: '',
    equipamento: '', operador: '', resp_tecnico: '', crea: '', receituario: '',
    carencia_dias: '', epi: '', clima_temp: '', clima_umidade: '', clima_vento: '', obs: '',
  };
}

export default function TabAplicacoes({ lote, cultura, propriedade = null, canDelete = true }) {
  const toast = useToast();
  const { aplicacoes, loading, add, remove } = useAplicacoes(lote.id);
  const cor = cultura?.cor ?? '#16a34a';

  const [showForm, setShowForm] = useState(false);
  const [showTec, setShowTec] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [form, setForm] = useState(() => emptyForm(lote));

  // Baixa de estoque (opcional) vinculada à aplicação
  const [estoque, setEstoque] = useState([]);
  const [baixaInsumoId, setBaixaInsumoId] = useState('');
  const [baixaQtd, setBaixaQtd] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const propId = propriedade?.id ?? lote.propriedade_id ?? null;
  useEffect(() => {
    loadEstoque(propId).then(setEstoque).catch(() => setEstoque([]));
  }, [propId]);

  const insumoBaixa = estoque.find(i => i.id === baixaInsumoId) || null;

  // Prefill do RT/CREA a partir da aplicação mais recente (conveniência)
  const ultimaComRT = useMemo(
    () => aplicacoes.find(a => a.resp_tecnico || a.crea) || null,
    [aplicacoes]
  );

  const openForm = () => {
    const base = emptyForm(lote);
    if (ultimaComRT) {
      base.resp_tecnico = ultimaComRT.resp_tecnico || '';
      base.crea = ultimaComRT.crea || '';
      base.equipamento = ultimaComRT.equipamento || '';
      base.epi = ultimaComRT.epi || '';
    }
    setForm(base);
    setBaixaInsumoId('');
    setBaixaQtd('');
    setShowTec(false);
    setShowForm(true);
  };

  const handleProduto = (val) => {
    setForm(f => {
      const next = { ...f, produto: val };
      const s = sugerirProduto(val);
      // só autopreenche se ainda vazio (não sobrescreve o que o usuário digitou)
      if (s) {
        if (!f.ingrediente_ativo) next.ingrediente_ativo = s.ingrediente_ativo;
        if (!f.classe) next.classe = s.classe;
      }
      return next;
    });
    // sugere o item de estoque correspondente para a baixa (se ainda não escolhido)
    if (!baixaInsumoId) {
      const m = matchEstoque(val, estoque);
      if (m) setBaixaInsumoId(m.id);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.produto.trim()) { toast.error('Informe o produto aplicado.'); return; }
    if (!form.data) { toast.error('Informe a data da aplicação.'); return; }
    const baixarQtd = parseFloat(baixaQtd);
    if (baixaInsumoId && baixarQtd > 0 && insumoBaixa && baixarQtd > insumoBaixa.quantidade) {
      if (!window.confirm(`A baixa (${baixarQtd} ${insumoBaixa.unidade}) é maior que o estoque de ${insumoBaixa.nome} (${insumoBaixa.quantidade} ${insumoBaixa.unidade}). O estoque ficará negativo. Continuar?`)) return;
    }
    setSaving(true);
    try {
      await add(form);
      // Conexão com o estoque/financeiro: baixa opcional do insumo aplicado
      if (baixaInsumoId && baixarQtd > 0) {
        await addMovimento({
          insumoId: baixaInsumoId,
          tipo: 'saida',
          quantidade: baixarQtd,
          data: form.data,
          plantioId: lote.id,
          observacao: `Aplicação: ${form.produto}${form.alvo ? ` — ${form.alvo}` : ''}`,
        });
        setEstoque(prev => prev.map(i => i.id === baixaInsumoId ? { ...i, quantidade: (parseFloat(i.quantidade) || 0) - baixarQtd } : i));
      }
      setBaixaInsumoId(''); setBaixaQtd('');
      setShowForm(false);
      toast.success(baixaInsumoId && baixarQtd > 0 ? 'Aplicação registrada e estoque atualizado!' : 'Aplicação registrada no caderno!');
    } catch {
      toast.error('Erro ao registrar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este registro do caderno de campo?')) return;
    try { await remove(id); } catch { toast.error('Erro ao remover.'); }
  };

  const handlePDF = async () => {
    setGerando(true);
    try {
      let produtor = '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        produtor = user?.user_metadata?.nome || user?.email || '';
      } catch { /* offline: segue sem nome */ }
      gerarCadernoCampoPDF({ lote, cultura, propriedade, aplicacoes, produtor });
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const inputCls = 'w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none bg-background';
  const labelCls = 'text-[10px] font-bold uppercase tracking-wide text-muted-foreground';
  const bd = { borderColor: `${cor}40` };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: cor }} /></div>;
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Cabeçalho + PDF */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cor}18` }}>
          <SprayCan size={17} style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight">Caderno de Campo</p>
          <p className="text-[11px] text-muted-foreground">{aplicacoes.length} aplicaç{aplicacoes.length === 1 ? 'ão' : 'ões'} registrada{aplicacoes.length === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={handlePDF}
          disabled={gerando || aplicacoes.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold disabled:opacity-40"
          style={{ background: `${cor}12`, color: cor, border: `1px solid ${cor}30` }}
        >
          {gerando ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          Relatório PDF
        </button>
      </div>

      {/* Botão novo / formulário */}
      <div>
        <button
          onClick={() => (showForm ? setShowForm(false) : openForm())}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-all"
          style={showForm
            ? { background: `${cor}10`, color: cor, border: `1.5px solid ${cor}40` }
            : { background: cor, color: 'white' }}
        >
          <Plus size={14} />
          {showForm ? 'Cancelar' : 'Registrar aplicação'}
        </button>

        <AnimatePresence>
          {showForm && (
            <motion.form
              onSubmit={handleSave}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }} className="mt-2"
            >
              <div className="card p-4 flex flex-col gap-3">
                {/* Essenciais */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={form.data} onChange={e => set('data', e.target.value)} className={inputCls} style={bd} />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo</label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls} style={bd}>
                      {TIPOS_APLICACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Produto (comercial)</label>
                  <input list="produtos-sugestao" value={form.produto} onChange={e => handleProduto(e.target.value)}
                    placeholder="Ex.: Manzate, Ureia, Roundup…" className={inputCls} style={bd} autoFocus />
                  <datalist id="produtos-sugestao">
                    {/* nomes comuns para autocompletar */}
                    {['Roundup','Gramoxone','Manzate','Dithane','Score','Karate','Decis','Vertimec','Ureia','NPK 04-14-08','Nitrato de Cálcio','Calcário Dolomítico'].map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Ingrediente ativo</label>
                    <input value={form.ingrediente_ativo} onChange={e => set('ingrediente_ativo', e.target.value)} placeholder="preenchido do rótulo" className={inputCls} style={bd} />
                  </div>
                  <div>
                    <label className={labelCls}>Classe</label>
                    <select value={form.classe} onChange={e => set('classe', e.target.value)} className={inputCls} style={bd}>
                      <option value="">—</option>
                      {CLASSES_APLICACAO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Alvo (praga/doença)</label>
                    <input value={form.alvo} onChange={e => set('alvo', e.target.value)} placeholder="Ex.: ferrugem, pulgão…" className={inputCls} style={bd} />
                  </div>
                  <div>
                    <label className={labelCls}>Dose</label>
                    <input value={form.dose} onChange={e => set('dose', e.target.value)} placeholder="Ex.: 2,5 kg/ha" className={inputCls} style={bd} />
                  </div>
                </div>

                {/* Baixa de estoque (opcional) — conecta caderno ↔ estoque ↔ financeiro */}
                {estoque.length > 0 && (
                  <div className="rounded-xl p-2.5" style={{ background: `${cor}0a`, border: `1px solid ${cor}22` }}>
                    <label className={labelCls}>Dar baixa no estoque (opcional)</label>
                    <div className="flex gap-2 mt-1">
                      <select value={baixaInsumoId} onChange={e => setBaixaInsumoId(e.target.value)}
                        className="flex-1 rounded-xl border px-2 py-2 text-[12px] outline-none bg-background" style={bd}>
                        <option value="">Não baixar</option>
                        {estoque.map(i => (
                          <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} {i.unidade})</option>
                        ))}
                      </select>
                      <input type="number" min="0" step="0.01" value={baixaQtd} onChange={e => setBaixaQtd(e.target.value)}
                        placeholder="qtd" disabled={!baixaInsumoId}
                        className="w-20 rounded-xl border px-2 py-2 text-sm outline-none bg-background disabled:opacity-50" style={bd} />
                      {insumoBaixa && <span className="self-center text-[11px] text-muted-foreground">{insumoBaixa.unidade}</span>}
                    </div>
                    <p className="text-[9.5px] text-muted-foreground mt-1">Registra a saída no estoque e lança o custo no Financeiro deste lote.</p>
                  </div>
                )}

                {/* Detalhes técnicos (MAPA) */}
                <button type="button" onClick={() => setShowTec(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold mt-1" style={{ color: cor }}>
                  <ChevronDown size={14} className={showTec ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  Detalhes técnicos {showTec ? '' : '(registro, RT, receituário, clima…)'}
                </button>

                <AnimatePresence>
                  {showTec && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }} className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Registro MAPA</label>
                          <input value={form.registro_mapa} onChange={e => set('registro_mapa', e.target.value)} placeholder="nº do rótulo" className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Carência (dias)</label>
                          <input type="number" min="0" value={form.carencia_dias} onChange={e => set('carencia_dias', e.target.value)} placeholder="intervalo seguran." className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Área tratada (ha)</label>
                          <input type="number" step="0.01" min="0" value={form.area_ha} onChange={e => set('area_ha', e.target.value)} className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Volume de calda</label>
                          <input value={form.volume_calda} onChange={e => set('volume_calda', e.target.value)} placeholder="Ex.: 200 L/ha" className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Equipamento</label>
                          <input value={form.equipamento} onChange={e => set('equipamento', e.target.value)} placeholder="Ex.: pulverizador costal" className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Operador</label>
                          <input value={form.operador} onChange={e => set('operador', e.target.value)} placeholder="quem aplicou" className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Resp. técnico</label>
                          <input value={form.resp_tecnico} onChange={e => set('resp_tecnico', e.target.value)} placeholder="agrônomo" className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>CREA</label>
                          <input value={form.crea} onChange={e => set('crea', e.target.value)} className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Receituário nº</label>
                          <input value={form.receituario} onChange={e => set('receituario', e.target.value)} className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>EPI utilizado</label>
                          <input value={form.epi} onChange={e => set('epi', e.target.value)} placeholder="Ex.: luva, máscara…" className={inputCls} style={bd} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>Temp. °C</label>
                          <input value={form.clima_temp} onChange={e => set('clima_temp', e.target.value)} className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Umid. %</label>
                          <input value={form.clima_umidade} onChange={e => set('clima_umidade', e.target.value)} className={inputCls} style={bd} />
                        </div>
                        <div>
                          <label className={labelCls}>Vento km/h</label>
                          <input value={form.clima_vento} onChange={e => set('clima_vento', e.target.value)} className={inputCls} style={bd} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Observações</label>
                        <input value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="opcional" className={inputCls} style={bd} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={saving}
                  className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-1"
                  style={{ background: cor, color: 'white' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Salvando…' : 'Salvar no caderno'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Lista */}
      {aplicacoes.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[12px] font-bold text-foreground">Registros</span>
          </div>
          <div className="divide-y divide-border">
            {aplicacoes.map(a => {
              const cCor = CLASSE_COR[a.classe] ?? '#4b5563';
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: cCor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">{a.produto}</span>
                      {a.classe && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cCor}18`, color: cCor }}>
                          {classeLabel(a.classe)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDatePtBR(a.data)}
                      {a.ingrediente_ativo && <> · {a.ingrediente_ativo}</>}
                      {a.dose && <> · {a.dose}</>}
                    </div>
                    {(a.alvo || a.carencia_dias != null) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {a.alvo && <>Alvo: {a.alvo}</>}
                        {a.alvo && a.carencia_dias != null && ' · '}
                        {a.carencia_dias != null && <>Carência: {a.carencia_dias}d</>}
                      </div>
                    )}
                  </div>
                  {canDelete && (
                    <button onClick={() => handleDelete(a.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <SprayCan size={28} className="mx-auto mb-2" style={{ color: `${cor}60` }} />
          <p className="text-[13px] font-semibold text-foreground">Caderno vazio</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Registre cada aplicação de defensivo ou adubo para manter a rastreabilidade e gerar o relatório oficial.
          </p>
        </div>
      )}
    </div>
  );
}
