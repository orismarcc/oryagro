import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CalendarDays, Sprout, CheckCircle2, Info, ChevronDown, ChevronUp, Leaf } from 'lucide-react';
import { calcularPlantas } from '../hooks/useSimulador';
import { registrarPlantio, deleteLote, updateLoteMudas, preCarregarEtapasPadrao } from '../hooks/useSupabaseSync';
import { resolveLifecycle, fmtDateBR, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LabelInput({ label, value, onChange, step = '1', min, suffix }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}{suffix ? ` (${suffix})` : ''}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl text-[13px] font-semibold text-foreground outline-none"
        style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
      />
    </div>
  );
}

function Metric({ label, value, cor }) {
  return (
    <div className="rounded-xl p-2 text-center" style={{ background: `${cor}0d` }}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5 leading-none">{label}</p>
      <p className="text-[13px] font-bold text-foreground leading-tight">{value}</p>
    </div>
  );
}

// ── LoteCard ──────────────────────────────────────────────────────────────

function LoteCard({ lote, cultura, cor, isCampo, onDelete, deleting }) {
  const lc = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita,
          faseAtual, faseIndex, dataPrimeiraProducao } = lc;
  const progressColor = prontoParaColheita ? '#16a34a' : cor;
  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  const dimensao = isCampo
    ? `${lote.area_ha ?? '—'} ha`
    : `${lote.comprimento_m ?? '—'}×${lote.largura_m ?? '—'} m`;

  // Propagation method
  const metodoObj = lote.metodo_propagacao && cultura?.metodosPropagacao
    ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao)
    : null;
  const diasViveiro = metodoObj?.diasViveiro ?? 0;
  const temViveiro = diasViveiro > 0;

  // Mudas/estacas progress (viveiro phase)
  const totalMudas = temViveiro ? Math.ceil((lote.total_plantas || 0) * 1.15) : 0;
  const [mudasFeitas, setMudasFeitas] = useState(lote.mudas_feitas ?? 0);
  const [showMudasUpdate, setShowMudasUpdate] = useState(false);
  const [novaMudas, setNovaMudas] = useState('');
  const [savingMudas, setSavingMudas] = useState(false);
  const pctMudas = totalMudas > 0 ? Math.min(100, Math.round((mudasFeitas / totalMudas) * 100)) : 0;

  const handleUpdateMudas = async () => {
    const v = parseInt(novaMudas);
    if (isNaN(v) || v < 0) return;
    setSavingMudas(true);
    const row = await updateLoteMudas(lote.id, Math.min(v, totalMudas));
    if (row) { setMudasFeitas(Math.min(v, totalMudas)); setNovaMudas(''); setShowMudasUpdate(false); }
    setSavingMudas(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="card p-4 space-y-3"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={10} style={{ color: cor }} />
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
            {metodoObj && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: `${cor}15`, color: cor }}>
                {metodoObj.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg transition-colors flex-shrink-0"
          style={{ color: '#ef4444' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label={isCampo ? 'Área' : 'Dimensão'} value={dimensao} cor={cor} />
        <Metric label="Plantas" value={(lote.total_plantas || 0).toLocaleString('pt-BR')} cor={cor} />
        <Metric label="Dias" value={diasDecorridos} cor={cor} />
      </div>

      {/* Viveiro / Mudas progress */}
      {temViveiro && totalMudas > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              🌱 {metodoObj?.label ?? 'Viveiro'}
            </span>
            <button
              onClick={() => setShowMudasUpdate(v => !v)}
              className="flex items-center gap-0.5 text-[11px] font-bold transition-colors"
              style={{ color: cor }}
            >
              {mudasFeitas.toLocaleString('pt-BR')} / {totalMudas.toLocaleString('pt-BR')} · {pctMudas}%
              {showMudasUpdate ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctMudas}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: `${cor}bb` }}
            />
          </div>
          <AnimatePresence>
            {showMudasUpdate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }} className="mt-2">
                <div className="flex gap-2">
                  <input type="number" min="0" max={totalMudas} value={novaMudas}
                    onChange={e => setNovaMudas(e.target.value)}
                    placeholder={`Total acumulado (máx. ${totalMudas})`}
                    className="flex-1 px-3 py-1.5 rounded-xl text-[12px] outline-none"
                    style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }} />
                  <button onClick={handleUpdateMudas} disabled={savingMudas || !novaMudas}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white disabled:opacity-50"
                    style={{ background: cor }}>
                    {savingMudas ? '…' : 'OK'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Cycle progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            {faseAtual ? <><Leaf size={9} /> {faseAtual}</> : 'Progresso'}
          </span>
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: progressColor }}>
            {prontoParaColheita
              ? <><CheckCircle2 size={11} /> Pronto p/ colheita</>
              : fmtDiasRestantes(diasParaColheita)
            }
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{ background: progressColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">Início</span>
          <span className="text-[9px] text-muted-foreground">{progresso}%</span>
          <span className="text-[9px] text-muted-foreground">
            1ª colheita: {fmtDateBR(dataPrimeiraProducao)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── PropagacaoSelector ──────────────────────────────────────────────────────

function PropagacaoSelector({ metodos, selected, onChange, cor }) {
  const selectedMetodo = metodos.find(m => m.key === selected);
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Método de propagação
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {metodos.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={selected === m.key
              ? { background: cor, color: '#fff' }
              : { background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}
          >
            {m.label}
            {m.diasViveiro > 0 && (
              <span className="ml-1 opacity-70">· {m.diasViveiro}d viveiro</span>
            )}
          </button>
        ))}
      </div>
      {selectedMetodo && (
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-[11px] text-muted-foreground"
          style={{ background: `${cor}08`, border: `1px solid ${cor}20` }}>
          <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: cor }} />
          <span>{selectedMetodo.descricao}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function LotesPage({ cultura, calc, onCalcChange, lotes, loadingLotes, onLoteAdded, onLoteDeleted, autoOpenForm = false, propriedadeId = null }) {
  const isCampo = cultura.tipo === 'campo';
  const cor = cultura.cor;
  const temMetodos = !!(cultura.metodosPropagacao?.length);
  const defaultMetodo = temMetodos ? cultura.metodosPropagacao[0].key : null;

  const [showForm, setShowForm]                 = useState(autoOpenForm);
  const [nome, setNome]                         = useState('');
  const [dataPlantio, setDataPlantio]           = useState(today);
  const [usaMudas, setUsaMudas]                 = useState(false);
  const [metodoPropagacao, setMetodoPropagacao] = useState(defaultMetodo);
  const [saving, setSaving]                     = useState(false);
  const [deletingId, setDeletingId]             = useState(null);

  const calcValores = {
    comprimento: calc.comprimento,
    largura: calc.largura,
    areaHa: calc.area,
    espacamentoLinhas: calc.linhas,
    espacamentoPlantas: calc.plantas,
  };
  const dim = calcularPlantas(cultura, calcValores);

  const metodoObj = temMetodos
    ? cultura.metodosPropagacao.find(m => m.key === metodoPropagacao) || cultura.metodosPropagacao[0]
    : null;
  const diasViveiro = metodoObj?.diasViveiro ?? (usaMudas ? 15 : 0);
  const temViveiroAtual = diasViveiro > 0;

  const precisaSaquinho = metodoObj?.saquinho && diasViveiro > 0;
  const qtdSaquinhos    = precisaSaquinho ? Math.ceil(dim.totalPlantas * 1.15) : null;

  const handleSalvar = async () => {
    if (!nome.trim()) return;

    // Validação de dimensões (o atributo HTML min não é confiável no Android WebView)
    if (isCampo) {
      const area = parseFloat(calc.area);
      if (!area || area <= 0) {
        alert('Informe uma área válida (maior que zero).');
        return;
      }
    } else {
      const comp = parseFloat(calc.comprimento);
      const larg = parseFloat(calc.largura);
      if (!comp || comp <= 0 || !larg || larg <= 0) {
        alert('Informe dimensões válidas para o canteiro (maiores que zero).');
        return;
      }
    }

    // Validação do número de plantas calculado
    if (dim.totalPlantas === 0) {
      alert('O espaçamento informado resulta em zero plantas. Verifique as dimensões e o espaçamento.');
      return;
    }

    // data_plantio obrigatória
    if (!dataPlantio) {
      alert('Informe a data de plantio.');
      return;
    }

    setSaving(true);

    const areaHaNum = parseFloat(calc.area) || 1;
    // If viveiro method: no field planting yet (area_plantada_ha = 0)
    const areaPlanNum = temViveiroAtual ? 0 : null;

    const payload = {
      cultura_id: cultura.id,
      nome: nome.trim(),
      data_plantio: dataPlantio,
      espacamento_linhas: parseFloat(calc.linhas) || (isCampo ? cultura.espacamento.linhas : cultura.canteiro.espacamentoLinhas),
      espacamento_plantas: parseFloat(calc.plantas) || (isCampo ? cultura.espacamento.plantas : cultura.canteiro.espacamentoPlantas),
      total_plantas: dim.totalPlantas,
      metodo_propagacao: temMetodos ? metodoPropagacao : (usaMudas ? 'mudas' : 'direto'),
      ...(propriedadeId ? { propriedade_id: propriedadeId } : {}),
      ...(areaPlanNum !== null && isCampo ? { area_plantada_ha: areaPlanNum } : {}),
      ...(isCampo
        ? { area_ha: areaHaNum }
        : {
            comprimento_m: parseFloat(calc.comprimento) || cultura.canteiro.comprimento,
            largura_m: parseFloat(calc.largura) || cultura.canteiro.largura,
          }
      ),
    };

    const novo = await registrarPlantio(payload);
    if (novo) {
      localStorage.setItem(`lote_mudas_${novo.id}`, diasViveiro > 0 ? '1' : '0');
      // Pre-load default schedule steps so the cronograma is not empty on first open
      preCarregarEtapasPadrao(novo, cultura, diasViveiro).catch(() => {});
      onLoteAdded(novo);
      setNome('');
      setDataPlantio(today());
      setUsaMudas(false);
      setMetodoPropagacao(defaultMetodo);
      setShowForm(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const ok = await deleteLote(id);
    if (ok) onLoteDeleted(id);
    setDeletingId(null);
  };

  return (
    <div className="px-4 pt-5 pb-6 max-w-2xl mx-auto space-y-4">

      {/* ── Lotes cadastrados (TOPO) ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="section-label">Lotes Cadastrados</p>
          <span className="text-[11px] text-muted-foreground">{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</span>
        </div>

        {loadingLotes ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-[13px] gap-2">
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${cor}55`, borderTopColor: 'transparent' }}
            />
            Carregando lotes…
          </div>
        ) : lotes.length === 0 ? (
          <div className="card p-7 flex flex-col items-center gap-2">
            <div className="icon-circle w-12 h-12 text-2xl" style={{ background: `${cor}10`, color: cor }}>
              <Sprout size={20} />
            </div>
            <p className="text-[13px] font-semibold text-foreground">Nenhum lote registrado</p>
            <p className="text-[11px] text-muted-foreground text-center">
              Adicione o primeiro lote usando o botão abaixo.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {lotes.map(lote => (
                <LoteCard
                  key={lote.id}
                  lote={lote}
                  cultura={cultura}
                  cor={cor}
                  isCampo={isCampo}
                  onDelete={() => handleDelete(lote.id)}
                  deleting={deletingId === lote.id}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Calculadora de dimensões ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label" style={{ color: cor }}>Dimensões</p>
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${cor}18`, color: cor }}>
            {dim.totalPlantas.toLocaleString('pt-BR')} plantas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isCampo ? (
            <>
              <LabelInput label="Área" suffix="ha" value={calc.area} step="0.1" min="0.1"
                onChange={v => onCalcChange(c => ({ ...c, area: v }))} />
              <LabelInput label="Esp. Linhas" suffix="m" value={calc.linhas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, linhas: v }))} />
              <LabelInput label="Esp. Plantas" suffix="m" value={calc.plantas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, plantas: v }))} />
            </>
          ) : (
            <>
              <LabelInput label="Comprimento" suffix="m" value={calc.comprimento} step="0.5" min="1"
                onChange={v => onCalcChange(c => ({ ...c, comprimento: v }))} />
              <LabelInput label="Largura" suffix="m" value={calc.largura} step="0.1" min="0.5"
                onChange={v => onCalcChange(c => ({ ...c, largura: v }))} />
              <LabelInput label="Esp. Linhas" suffix="m" value={calc.linhas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, linhas: v }))} />
              <LabelInput label="Esp. Plantas" suffix="m" value={calc.plantas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, plantas: v }))} />
            </>
          )}
        </div>

        {!isCampo && dim.linhas !== undefined && (
          <p className="text-[11px] text-muted-foreground">
            {dim.linhas} linhas × {dim.porLinha} plantas — {dim.area?.toFixed(1)} m²
          </p>
        )}

        {isCampo && precisaSaquinho && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
            style={{ background: `${cor}08`, border: `1px solid ${cor}20` }}>
            <span className="text-base">🪣</span>
            <div>
              <span className="font-bold text-foreground">{qtdSaquinhos?.toLocaleString('pt-BR')} saquinhos</span>
              <span className="text-muted-foreground ml-1">a preparar (+ 15% reserva)</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Adicionar novo lote (BAIXO, dropdown) ── */}
      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.button
            key="btn"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-[0.98]"
            style={{ background: `${cor}12`, color: cor, border: `1.5px dashed ${cor}55` }}
          >
            <Plus size={15} />
            Registrar novo lote
          </motion.button>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-foreground">Novo lote</p>
                <button onClick={() => setShowForm(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
              </div>

              {/* Nome */}
              <input
                type="text"
                placeholder="Nome do lote (ex: Acerola Leste A)"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
              />

              {/* Método de propagação */}
              {temMetodos ? (
                <PropagacaoSelector
                  metodos={cultura.metodosPropagacao}
                  selected={metodoPropagacao}
                  onChange={setMetodoPropagacao}
                  cor={cor}
                />
              ) : cultura.suportaMudas ? (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[12px] font-semibold text-foreground">Tipo de plantio</span>
                  <div className="flex rounded-xl overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
                    <button type="button" onClick={() => setUsaMudas(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all"
                      style={!usaMudas ? { background: cor, color: '#fff' } : { color: 'hsl(215 16% 45%)' }}>
                      Direto
                    </button>
                    <button type="button" onClick={() => setUsaMudas(true)}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all"
                      style={usaMudas ? { background: cor, color: '#fff' } : { color: 'hsl(215 16% 45%)' }}>
                      Mudas
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Aviso: sem plantio no campo ainda */}
              {temViveiroAtual && (
                <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-[11px]"
                  style={{ background: 'hsl(38 90% 97%)', border: '1px solid hsl(38 90% 85%)' }}>
                  <span className="text-base leading-none">⏳</span>
                  <span className="text-muted-foreground">
                    Com este método, <strong>o campo ainda não terá plantas</strong>. O cronograma começa pelo viveiro ({diasViveiro} dias). O plantio no campo será registrado após o transplante.
                  </span>
                </div>
              )}

              {/* Data de início */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {diasViveiro > 0 ? 'Data de início no viveiro' : 'Data do plantio'}
                </label>
                <input
                  type="date"
                  value={dataPlantio}
                  onChange={e => setDataPlantio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
                />
                {diasViveiro > 0 && dataPlantio && (
                  <p className="text-[11px] text-muted-foreground">
                    📅 Transplante ao campo previsto: <strong>{addDays(dataPlantio, diasViveiro)}</strong>
                  </p>
                )}
              </div>

              {/* Resumo */}
              <div className="rounded-xl p-3 text-[11px]" style={{ background: `${cor}0a`, border: `1px solid ${cor}22` }}>
                <p className="font-semibold mb-1" style={{ color: cor }}>Resumo</p>
                <p className="text-muted-foreground">
                  {isCampo
                    ? `${calc.area} ha · ${dim.totalPlantas.toLocaleString('pt-BR')} plantas`
                    : `${calc.comprimento}×${calc.largura} m · ${dim.totalPlantas.toLocaleString('pt-BR')} plantas`
                  }
                </p>
                {metodoObj && (
                  <p className="text-muted-foreground mt-0.5">
                    {metodoObj.label}
                    {diasViveiro > 0 ? ` · ${diasViveiro} dias viveiro` : ''}
                    {qtdSaquinhos ? ` · ${qtdSaquinhos.toLocaleString('pt-BR')} saquinhos` : ''}
                  </p>
                )}
              </div>

              <button
                onClick={handleSalvar}
                disabled={saving || !nome.trim()}
                className="w-full py-2.5 rounded-xl text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: cor }}
              >
                {saving ? 'Salvando…' : 'Salvar Lote'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
