import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CalendarDays, Sprout, CheckCircle2 } from 'lucide-react';
import { calcularPlantas } from '../hooks/useSimulador';
import { registrarPlantio, deleteLote } from '../hooks/useSupabaseSync';

function parseCicloDias(cicloStr) {
  const match = cicloStr?.match(/\d+/g);
  if (!match) return 60;
  return parseInt(match[match.length - 1]);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LabelInput({ label, value, onChange, step = '1', min }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
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

function LoteCard({ lote, cor, cicloDias, isCampo, onDelete, deleting }) {
  const diasDecorridos = Math.floor(
    (Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000
  );
  const progresso = Math.min((diasDecorridos / cicloDias) * 100, 100);
  const concluido = diasDecorridos >= cicloDias;
  const diasRestantes = Math.max(cicloDias - diasDecorridos, 0);
  const progressColor = concluido ? '#16a34a' : cor;

  const dimensao = isCampo
    ? `${lote.area_ha ?? '—'} ha`
    : `${lote.comprimento_m ?? '—'}×${lote.largura_m ?? '—'} m`;

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
          <div className="flex items-center gap-1.5 mt-0.5">
            <CalendarDays size={10} style={{ color: cor }} />
            <span className="text-[11px] text-muted-foreground">
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
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

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label={isCampo ? 'Área' : 'Dimensão'} value={dimensao} cor={cor} />
        <Metric label="Plantas" value={(lote.total_plantas || 0).toLocaleString('pt-BR')} cor={cor} />
        <Metric label="Dias" value={diasDecorridos} cor={cor} />
      </div>

      {/* Cycle progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Ciclo de crescimento
          </span>
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: progressColor }}>
            {concluido
              ? <><CheckCircle2 size={11} /> Pronto p/ colheita</>
              : `${diasRestantes}d restantes`
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
          <span className="text-[9px] text-muted-foreground">Plantio</span>
          <span className="text-[9px] text-muted-foreground">{Math.round(progresso)}%</span>
          <span className="text-[9px] text-muted-foreground">Dia {cicloDias}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function LotesPage({ cultura, calc, onCalcChange, lotes, loadingLotes, onLoteAdded, onLoteDeleted, autoOpenForm = false }) {
  const isCampo = cultura.tipo === 'campo';
  const cor = cultura.cor;
  const cicloDias = parseCicloDias(cultura.ciclo);

  const [showForm, setShowForm] = useState(autoOpenForm);
  const [nome, setNome] = useState('');
  const [dataPlantio, setDataPlantio] = useState(today);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Map calc state to valores format expected by calcularPlantas
  const calcValores = {
    comprimento: calc.comprimento,
    largura: calc.largura,
    areaHa: calc.area,
    espacamentoLinhas: calc.linhas,
    espacamentoPlantas: calc.plantas,
  };
  const dim = calcularPlantas(cultura, calcValores);

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    setSaving(true);

    const payload = {
      cultura_id: cultura.id,
      nome: nome.trim(),
      data_plantio: dataPlantio,
      espacamento_linhas: parseFloat(calc.linhas) || (isCampo ? cultura.espacamento.linhas : cultura.canteiro.espacamentoLinhas),
      espacamento_plantas: parseFloat(calc.plantas) || (isCampo ? cultura.espacamento.plantas : cultura.canteiro.espacamentoPlantas),
      total_plantas: dim.totalPlantas,
      ...(isCampo
        ? { area_ha: parseFloat(calc.area) || 1 }
        : {
            comprimento_m: parseFloat(calc.comprimento) || cultura.canteiro.comprimento,
            largura_m: parseFloat(calc.largura) || cultura.canteiro.largura,
          }
      ),
    };

    const novo = await registrarPlantio(payload);
    if (novo) {
      onLoteAdded(novo);
      setNome('');
      setDataPlantio(today());
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

      {/* ── Calculator card ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label" style={{ color: cor }}>Dimensões do Plantio</p>
          <span
            className="text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${cor}18`, color: cor }}
          >
            {dim.totalPlantas.toLocaleString('pt-BR')} plantas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isCampo ? (
            <>
              <LabelInput label="Área (ha)" value={calc.area} step="0.1" min="0.1"
                onChange={v => onCalcChange(c => ({ ...c, area: v }))} />
              <LabelInput label="Esp. Linhas (m)" value={calc.linhas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, linhas: v }))} />
              <LabelInput label="Esp. Plantas (m)" value={calc.plantas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, plantas: v }))} />
            </>
          ) : (
            <>
              <LabelInput label="Comprimento (m)" value={calc.comprimento} step="0.5" min="1"
                onChange={v => onCalcChange(c => ({ ...c, comprimento: v }))} />
              <LabelInput label="Largura (m)" value={calc.largura} step="0.1" min="0.5"
                onChange={v => onCalcChange(c => ({ ...c, largura: v }))} />
              <LabelInput label="Esp. Linhas (m)" value={calc.linhas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, linhas: v }))} />
              <LabelInput label="Esp. Plantas (m)" value={calc.plantas} step="0.05" min="0.05"
                onChange={v => onCalcChange(c => ({ ...c, plantas: v }))} />
            </>
          )}
        </div>

        {!isCampo && dim.linhas !== undefined && (
          <p className="text-[11px] text-muted-foreground">
            {dim.linhas} linhas × {dim.porLinha} plantas — {dim.area?.toFixed(1)} m²
          </p>
        )}
      </div>

      {/* ── New lot button / inline form ── */}
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
            Salvar como Novo Lote
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
            <div className="card p-4 space-y-3">
              <p className="text-[13px] font-bold text-foreground">Registrar Lote</p>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nome do lote (ex: Canteiro A)"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Data do plantio
                  </label>
                  <input
                    type="date"
                    value={dataPlantio}
                    onChange={e => setDataPlantio(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                    style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
                  />
                </div>
              </div>

              {/* Summary preview */}
              <div className="rounded-xl p-3 text-[11px]" style={{ background: `${cor}0a`, border: `1px solid ${cor}22` }}>
                <p className="font-semibold text-foreground mb-1" style={{ color: cor }}>Resumo do lote</p>
                <p className="text-muted-foreground">
                  {isCampo
                    ? `${calc.area} ha · ${dim.totalPlantas.toLocaleString('pt-BR')} plantas`
                    : `${calc.comprimento}×${calc.largura} m · ${dim.totalPlantas.toLocaleString('pt-BR')} plantas`
                  }
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-muted-foreground"
                  style={{ background: 'hsl(210 16% 96%)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={saving || !nome.trim()}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: cor }}
                >
                  {saving ? 'Salvando…' : 'Salvar Lote'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lots list ── */}
      <div>
        <p className="section-label mb-3 px-1">Lotes Cadastrados</p>

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
              Configure as dimensões acima e salve seu primeiro lote.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {lotes.map(lote => (
                <LoteCard
                  key={lote.id}
                  lote={lote}
                  cor={cor}
                  cicloDias={cicloDias}
                  isCampo={isCampo}
                  onDelete={() => handleDelete(lote.id)}
                  deleting={deletingId === lote.id}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
