import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Plus, Printer, Trash2, CheckCircle2, Circle, ChevronRight, CalendarDays, X, Layers, AlertCircle, Leaf } from 'lucide-react';
import { resolveLifecycle, fmtDateBR, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';
import { loadEstoque, addMovimento } from '../hooks/useGestao';
import { addEvento, syncCronogramaStatus, loadCronogramaAtividades } from '../hooks/useSupabaseSync';
import { buildStatusFromDbRows, useCronogramaRealtime } from '../hooks/useCronogramaSync';
import { logDbError } from '../lib/logger';

const TIPO_META = {
  plantio:   { color: '#059669', bg: 'hsl(152 69% 93%)', label: 'Plantio',   emoji: '🌱' },
  adubo:     { color: '#d97706', bg: 'hsl(43 96% 93%)',  label: 'Adubação',  emoji: '🧪' },
  foliar:    { color: '#2563eb', bg: 'hsl(221 90% 95%)', label: 'Foliar',    emoji: '💧' },
  colheita:  { color: '#dc2626', bg: 'hsl(4 80% 94%)',   label: 'Colheita',  emoji: '🌾' },
  manejo:    { color: '#7c3aed', bg: 'hsl(263 80% 95%)', label: 'Manejo',    emoji: '🔧' },
  especial:  { color: '#db2777', bg: 'hsl(322 75% 95%)', label: 'Especial',  emoji: '⭐' },
  aplicacao: { color: '#7c3aed', bg: 'hsl(263 80% 95%)', label: 'Aplicação', emoji: '🌿' },
};
const TIPOS = Object.keys(TIPO_META);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Add `dia` days to a date_plantio string, returns a Date
function stepDate(datePlantio, dia) {
  const d = new Date(datePlantio + 'T12:00:00');
  d.setDate(d.getDate() + dia);
  return d;
}

function formatStepDate(datePlantio, dia) {
  const d = stepDate(datePlantio, dia);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Stable step IDs ──────────────────────────────────────────────────────────
function makeStableId(prefix, etapa) {
  const slug = etapa
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug}`;
}

function migrateLegacyStatus(stored, vivSteps, baseSteps) {
  // O-01: skip migration if already done (flag set on previous run)
  if (stored._migrated) return stored;
  let changed = false;
  const migrated = {};

  Object.entries(stored).forEach(([oldId, val]) => {
    const legacyMatch = oldId.match(/^(viveiro|default)_(\d+)$/);
    if (!legacyMatch) {
      migrated[oldId] = val;
      return;
    }
    const prefix = legacyMatch[1];
    const idx    = parseInt(legacyMatch[2], 10);
    const steps  = prefix === 'viveiro' ? vivSteps : baseSteps;
    if (steps[idx]) {
      const newId = makeStableId(prefix, steps[idx].etapa);
      migrated[newId] = val;
      if (newId !== oldId) changed = true;
    }
  });

  // O-01: stamp _migrated flag so future mounts skip this loop
  if (changed) {
    migrated._migrated = true;
    return migrated;
  }
  // Also stamp on existing stored object so we skip next time
  stored._migrated = true;
  return stored;
}

// Scale numeric values in a dose string by a factor
function scaleDose(doseStr, fator) {
  if (!doseStr || doseStr === '—' || Math.abs(fator - 1) < 0.02) return doseStr;
  return doseStr.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    if (isNaN(num)) return match;
    const scaled = Math.round(num * fator);
    return scaled.toString();
  });
}

// Convert ISO date string to Date object (treating as local noon to avoid timezone offset issues)
function isoToDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00:00');
}

// Convert Date to ISO yyyy-mm-dd
function dateToISO(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle, color }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative flex-shrink-0"
      style={{ width: 40, height: 22 }}
    >
      <span className="absolute inset-0 rounded-full transition-colors"
        style={{ background: enabled ? color : 'hsl(210 16% 88%)' }} />
      <span className="absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow transition-all"
        style={{ left: enabled ? 21 : 3 }} />
    </button>
  );
}

// ── Lote picker pill ─────────────────────────────────────────────────────
// Only shown when there are multiple lotes — never shows "Genérico" option.
function LotePicker({ lotes, selectedId, onSelect, cor }) {
  // If only one lote, no picker needed (auto-selected)
  if (lotes.length <= 1) return null;
  return (
    <div className="mb-4">
      <p className="section-label mb-2 px-1">Selecionar lote</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {lotes.map(l => (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
            style={selectedId === l.id
              ? { background: cor, color: '#fff' }
              : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 40%)' }
            }
          >
            <Layers size={10} />
            {l.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function CronogramaTimeline({ cultura, lotes = [], propriedadeId = null }) {
  const isCampo = cultura.tipo === 'campo';
  const cor = cultura.cor;

  // Lote selection
  const [selectedLoteId, setSelectedLoteId] = useState(null);

  // Auto-select most recent lote when lotes load
  useEffect(() => {
    if (lotes.length > 0 && selectedLoteId === null) {
      setSelectedLoteId(lotes[0].id);
    }
  }, [lotes]);

  const selectedLote = lotes.find(l => l.id === selectedLoteId) || null;

  // Storage keys: per-lote if lote selected, else per-cultura
  const storageKey = selectedLote
    ? `cronograma_status_lote_${selectedLote.id}`
    : `cronograma_status_${cultura.id}`;
  const customKey = selectedLote
    ? `cronograma_custom_lote_${selectedLote.id}`
    : `cronograma_custom_${cultura.id}`;

  const [status, setStatus]         = useState({});
  const [customRows, setCustomRows] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [confirmDate, setConfirmDate] = useState(todayISO());
  const [removingId, setRemovingId] = useState(null); // Feature 1: inline remove confirm
  const [descricaoStep, setDescricaoStep] = useState(null); // Feature 2: bottom sheet (portal)
  const confirmFormRefs = useRef({}); // { [cardId]: DOMElement }
  const [addDialog, setAddDialog]   = useState(false);
  const [newRow, setNewRow]         = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo', insumo_id: '', dataPrevista: '' });
  const [insumos, setInsumos]   = useState([]);
  const [stockDebit, setStockDebit] = useState({ enabled: false, insumoId: '', quantidade: '' });

  // Harvest data state (for confirm form and add dialog)
  const [harvestData, setHarvestData] = useState({
    enabled: false, qtd: '', unidade: 'kg',
    polpa: false, qtdPolpa: '', unidadePolpa: 'kg'
  });

  // Add dialog harvest state (for "já realizada" toggle in add dialog)
  const [addHarvest, setAddHarvest] = useState({
    jaRealizada: false, qtd: '', unidade: 'kg',
    polpa: false, qtdPolpa: '', unidadePolpa: 'kg'
  });

  // ── Mudas flag (legacy fallback) — declared BEFORE the useEffect that uses it ──
  const usaMudas = selectedLote
    ? localStorage.getItem(`lote_mudas_${selectedLote.id}`) === '1'
    : false;

  // ── Resolve propagation method from lote — declared BEFORE the useEffect that uses it ──
  const metodoObj = (selectedLote?.metodo_propagacao && cultura.metodosPropagacao)
    ? (cultura.metodosPropagacao.find(m => m.key === selectedLote.metodo_propagacao) ?? null)
    : null;

  // Reload status/custom from storage when key changes, then merge with Supabase
  useEffect(() => {
    // 1. Load from localStorage immediately (fast initial render, offline fallback)
    const vivSteps = metodoObj?.etapasViveiro ?? (usaMudas ? [{ etapa: 'Semeadura em bandeja' }] : []);
    let localStatus = {};
    let localCustomRows = [];
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey)) || {};
      const migrated = migrateLegacyStatus(raw, vivSteps, cultura.cronograma);
      if (migrated !== raw) localStorage.setItem(storageKey, JSON.stringify(migrated));
      localStatus = migrated;
    } catch { localStatus = {}; }
    try { localCustomRows = JSON.parse(localStorage.getItem(customKey)) || []; } catch { localCustomRows = []; }

    setStatus(localStatus);
    setCustomRows(localCustomRows);
    setConfirming(null);
    setHarvestData({ enabled: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });

    // 2. Rehydrate from Supabase (source of truth for multi-device sync)
    if (selectedLote?.id) {
      loadCronogramaAtividades(selectedLote.id).then(dbRows => {
        if (!dbRows.length) return; // nada no banco ainda — localStorage está OK

        const dbStatus = {};
        const dbCustomDefs = [];

        dbRows.forEach(row => {
          if (row.is_custom) {
            // Reconstrói a definição da atividade customizada
            dbCustomDefs.push({
              dia:     row.dia_previsto,
              etapa:   row.etapa,
              produto: row.produto || '',
              dose:    row.dose || '',
              forma:   row.forma_aplicacao || '',
              tipo:    row.tipo || 'manejo',
            });
          } else {
            // Determina o prefixo do ID estável (viveiro vs default)
            const isViveiro = vivSteps.some(e => e.etapa === row.etapa);
            const _id = makeStableId(isViveiro ? 'viveiro' : 'default', row.etapa);
            if (row.status && row.status !== 'pendente') {
              dbStatus[_id] = { status: row.status, data: row.data_execucao };
            }
          }
        });

        // Status das atividades customizadas (indexado por posição no array)
        const customDbRows = dbRows.filter(r => r.is_custom);
        customDbRows.forEach((row, i) => {
          if (row.status && row.status !== 'pendente') {
            dbStatus[`custom_${i}`] = { status: row.status, data: row.data_execucao };
          }
        });

        // Merge: Supabase prevalece sobre localStorage para status com valor
        const merged = { ...localStatus, ...dbStatus };
        const finalCustomRows = dbCustomDefs.length > 0 ? dbCustomDefs : localCustomRows;

        // Mantém localStorage sincronizado (cache offline)
        localStorage.setItem(storageKey, JSON.stringify(merged));
        if (dbCustomDefs.length > 0) localStorage.setItem(customKey, JSON.stringify(finalCustomRows));

        setStatus(merged);
        setCustomRows(finalCustomRows);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, customKey]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(status)); }, [storageKey, status]);
  useEffect(() => { localStorage.setItem(customKey, JSON.stringify(customRows)); }, [customKey, customRows]);

  // Scroll the inline confirm form into view whenever it opens
  useEffect(() => {
    if (confirming && confirmFormRefs.current[confirming.id]) {
      setTimeout(() => {
        confirmFormRefs.current[confirming.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 220); // wait for the AnimatePresence height animation to expand
    }
  }, [confirming]);

  // ── Realtime: merge remote changes from other devices/users ─────────────────
  const vivStepsForRealtime = (metodoObj?.etapasViveiro ?? []);
  useCronogramaRealtime(selectedLote?.id, (dbRows) => {
    const { statusMap: dbStatus, customRows: dbCustomRows } = buildStatusFromDbRows(dbRows, vivStepsForRealtime);
    // Merge: DB wins. Preserves local-only keys (e.g. _migrated flag).
    setStatus(prev => {
      const merged = { ...prev, ...dbStatus };
      localStorage.setItem(storageKey, JSON.stringify(merged));
      return merged;
    });
    if (dbCustomRows.length) {
      setCustomRows(dbCustomRows);
      localStorage.setItem(customKey, JSON.stringify(dbCustomRows));
    }
  });

  useEffect(() => {
    if (!propriedadeId) { setInsumos([]); return; }
    loadEstoque(propriedadeId).then(setInsumos);
  }, [propriedadeId]);

  // ── Dose scaling factor ──
  const baseArea = isCampo
    ? (cultura.area?.padrao || 1)
    : (cultura.canteiro.comprimento * cultura.canteiro.largura);

  const loteArea = selectedLote
    ? (isCampo
        ? parseFloat(selectedLote.area_ha) || 1
        : (parseFloat(selectedLote.comprimento_m) || cultura.canteiro.comprimento) *
          (parseFloat(selectedLote.largura_m) || cultura.canteiro.largura))
    : baseArea;

  const fator = loteArea / baseArea;
  const isScaled = Math.abs(fator - 1) > 0.02;

  const diasViveiroAtual = metodoObj
    ? (metodoObj.diasViveiro || 0)
    : (usaMudas ? 15 : 0);

  // ── Days elapsed for selected lote ──
  const diasDecorridos = selectedLote
    ? Math.max(0, Math.floor((Date.now() - new Date(selectedLote.data_plantio + 'T12:00:00')) / 86_400_000))
    : null;

  // ── Lifecycle anchor ──
  const metodoLifecycle = metodoObj?.lifecycle ?? null;
  const diasPrimeiraProducaoAtual = metodoLifecycle?.diasPrimeiraProducao ?? null;
  const maxBaseDia = cultura.cronograma.length > 0
    ? Math.max(...cultura.cronograma.map(e => e.dia))
    : 0;

  const scaleBaseDia = (originalDia) => {
    if (!diasPrimeiraProducaoAtual || maxBaseDia === 0 || !selectedLote) {
      return originalDia + diasViveiroAtual;
    }
    return Math.round(
      diasViveiroAtual + (originalDia / maxBaseDia) * (diasPrimeiraProducaoAtual - diasViveiroAtual)
    );
  };

  // ── Full lifecycle state for the summary card ──
  const lc = (selectedLote && metodoLifecycle)
    ? resolveLifecycle(selectedLote, cultura)
    : null;

  // Pre-fill confirm date for lote steps
  const getDefaultConfirmDate = (dia) => {
    if (!selectedLote) return todayISO();
    const d = stepDate(selectedLote.data_plantio, dia);
    return d.toISOString().split('T')[0];
  };

  // Compute dataPrevista ISO for a given dia (used in add dialog)
  const computeDataPrevista = (dia) => {
    if (!selectedLote || !selectedLote.data_plantio || dia === '' || dia === undefined) return '';
    const diaNum = parseInt(dia, 10);
    if (isNaN(diaNum)) return '';
    const d = stepDate(selectedLote.data_plantio, diaNum);
    return dateToISO(d);
  };

  // When dataPrevista changes, compute dia from it
  const computeDiaFromDate = (isoDate) => {
    if (!selectedLote || !selectedLote.data_plantio || !isoDate) return '';
    const plantioDate = isoToDate(selectedLote.data_plantio);
    const targetDate = isoToDate(isoDate);
    if (!plantioDate || !targetDate) return '';
    return Math.round((targetDate - plantioDate) / 86400000);
  };

  // Legacy fallback step
  const semeaduraBandeja = {
    dia: 0, _id: 'semeadura_bandeja', _custom: false,
    etapa: 'Semeadura em bandeja', produto: 'Sementes', dose: '—',
    forma: 'Semeadura em bandeja/viveiro. Transplante previsto em ~15 dias.', tipo: 'plantio',
  };

  // Viveiro steps
  const etapasViveiro = metodoObj?.etapasViveiro?.length
    ? metodoObj.etapasViveiro.map(e => ({
        ...e,
        _id: makeStableId('viveiro', e.etapa),
        _custom: false,
        _viveiro: true,
      }))
    : (usaMudas ? [semeaduraBandeja] : []);

  const vivTemTransplante = etapasViveiro.some(e => e.tipo === 'especial');

  const allEvents = [
    ...etapasViveiro,
    ...cultura.cronograma
      .filter(e => !(vivTemTransplante && e.dia === 0 && e.tipo === 'plantio'))
      .map(e => {
        const override = {};
        if (e.tipo === 'plantio' && e.dia === 0 && selectedLote && metodoObj) {
          override.produto = metodoObj.label;
          if (selectedLote.total_plantas > 0) {
            const linhasEsp  = parseFloat(selectedLote.espacamento_linhas)  || cultura.espacamento?.linhas  || 4;
            const plantasEsp = parseFloat(selectedLote.espacamento_plantas) || cultura.espacamento?.plantas || 4;
            const plantsPerHa = Math.round(10000 / (linhasEsp * plantasEsp));
            override.dose = `${selectedLote.total_plantas.toLocaleString('pt-BR')} mudas · ${plantsPerHa}/ha`;
            override._noScaleDose = true;
          }
        }
        return { ...e, ...override, dia: scaleBaseDia(e.dia), _id: makeStableId('default', e.etapa), _custom: false };
      }),
    ...customRows.map((e, i) => ({ ...e, _id: `custom_${i}`, _custom: true })),
  ]
  .filter(e => status[e._id]?.status !== 'removida')
  .sort((a, b) => a.dia - b.dia);

  const feitos   = allEvents.filter(e => status[e._id]?.status === 'feito').length;
  const progress = allEvents.length > 0 ? feitos / allEvents.length : 0;

  const confirmStep = async (id) => {
    setStatus(s => ({ ...s, [id]: { status: 'feito', data: confirmDate } }));
    // I-04 / Sugestão 1: persist step status to Supabase for multi-device sync
    if (selectedLote?.id && confirming) {
      syncCronogramaStatus(selectedLote.id, cultura.id, {
        dia:      confirming.dia,
        etapa:    confirming.etapa,
        produto:  confirming.produto  || '',
        dose:     confirming.dose     || '',
        forma:    confirming.forma    || '',
        tipo:     confirming.tipo     || 'manejo',
        status:   'feito',
        data:     confirmDate,
        isCustom: confirming._custom  || false,
      });
    }

    // Debitar estoque (adubo/foliar)
    if (
      stockDebit.enabled &&
      stockDebit.insumoId &&
      parseFloat(stockDebit.quantidade) > 0 &&
      selectedLote
    ) {
      await addMovimento({
        insumoId: stockDebit.insumoId,
        tipo: 'saida',
        quantidade: parseFloat(stockDebit.quantidade),
        observacao: `Uso — ${confirming?.etapa || 'etapa cronograma'}`,
        data: confirmDate,
        plantioId: selectedLote.id,
      });
      if (propriedadeId) loadEstoque(propriedadeId).then(setInsumos);
    }

    // Registrar colheita
    if (confirming?.tipo === 'colheita' && harvestData.enabled && selectedLote) {
      try {
        await addEvento({
          plantio_id: selectedLote.id,
          data: confirmDate,
          tipo: 'colheita',
          descricao: JSON.stringify({
            qtd: parseFloat(harvestData.qtd) || 0,
            unidade: harvestData.unidade,
            polpa: harvestData.polpa ? (parseFloat(harvestData.qtdPolpa) || 0) : null,
            unidadePolpa: harvestData.polpa ? harvestData.unidadePolpa : null,
            etapa: confirming.etapa,
          }),
        });
      } catch (err) {
        logDbError('confirmStep:colheita', err);
      }
    }

    setConfirming(null);
    setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
    setHarvestData({ enabled: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });
  };

  const undoStep = (id) => {
    setStatus(s => { const n = { ...s }; delete n[id]; return n; });
    // I-04 / Sugestão 1: reflect undo in Supabase — find the step data from allEvents
    if (selectedLote?.id) {
      const step = allEvents.find(e => e._id === id);
      if (step) {
        syncCronogramaStatus(selectedLote.id, cultura.id, {
          dia:      step.dia,
          etapa:    step.etapa,
          produto:  step.produto  || '',
          dose:     step.dose     || '',
          forma:    step.forma    || '',
          tipo:     step.tipo     || 'manejo',
          status:   'pendente',
          data:     null,
          isCustom: step._custom  || false,
        });
      }
    }
  };
  // Feature 1: permanent step removal
  const removeStep = async (step) => {
    // 1. Update local state immediately
    setStatus(s => ({ ...s, [step._id]: { status: 'removida' } }));

    // 2. Sync to Supabase
    if (selectedLote?.id) {
      syncCronogramaStatus(selectedLote.id, cultura.id, {
        dia: step.dia,
        etapa: step.etapa,
        produto: step.produto || '',
        dose: step.dose || '',
        forma: step.forma || '',
        tipo: step.tipo || 'manejo',
        status: 'removida',
        data: null,
        isCustom: step._custom || false,
      });
    }

    // 3. If custom row, also remove from customRows array
    if (step._custom) {
      const idx = parseInt(step._id.replace('custom_', ''));
      setCustomRows(rows => rows.filter((_, i) => i !== idx));
    }

    setRemovingId(null);
  };

  // I-15: removed saveColheitaToCalendario — CalendarioPage now reads directly
  // from cronograma_custom_lote_${id} and cronograma_status_lote_${id} (no duplicate store needed)

  // ── Add dialog submit ──
  const handleAddRow = async () => {
    if (!newRow.etapa) return;

    const diaNum = parseInt(newRow.dia) || 0;
    const rowToAdd = { ...newRow, dia: diaNum, insumo_id: newRow.insumo_id || null };

    // For colheita: if "já realizada" is on, register event
    if (newRow.tipo === 'colheita' && addHarvest.jaRealizada && selectedLote) {
      const isoDate = newRow.dataPrevista || computeDataPrevista(diaNum) || todayISO();
      try {
        await addEvento({
          plantio_id: selectedLote.id,
          data: isoDate,
          tipo: 'colheita',
          descricao: JSON.stringify({
            qtd: parseFloat(addHarvest.qtd) || 0,
            unidade: addHarvest.unidade,
            polpa: addHarvest.polpa ? (parseFloat(addHarvest.qtdPolpa) || 0) : null,
            unidadePolpa: addHarvest.polpa ? addHarvest.unidadePolpa : null,
            etapa: newRow.etapa,
          }),
        });
      } catch (err) {
        logDbError('handleAddRow:colheita', err);
      }
      // Also auto-mark as done in status
      const tempId = `custom_${customRows.length}`;
      setStatus(s => ({ ...s, [tempId]: { status: 'feito', data: isoDate } }));
    }

    setCustomRows(r => [...r, rowToAdd]);

    // Sync custom activity to Supabase so it persists cross-device
    if (selectedLote?.id) {
      const jaFeita = newRow.tipo === 'colheita' && addHarvest.jaRealizada;
      const isoDate = newRow.dataPrevista || computeDataPrevista(diaNum) || null;
      syncCronogramaStatus(selectedLote.id, cultura.id, {
        dia:     diaNum,
        etapa:   rowToAdd.etapa,
        produto: rowToAdd.produto || '',
        dose:    rowToAdd.dose || '',
        forma:   rowToAdd.forma || '',
        tipo:    rowToAdd.tipo || 'manejo',
        status:  jaFeita ? 'feito' : 'pendente',
        data:    jaFeita ? isoDate : null,
        isCustom: true,
      });
    }

    setNewRow({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo', insumo_id: '', dataPrevista: '' });
    setAddHarvest({ jaRealizada: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });
    setAddDialog(false);
  };

  const isInsumeTipo = (t) => t === 'adubo' || t === 'foliar' || t === 'aplicacao';

  // Selected insumo unit in add dialog
  const selectedInsumoUnit = newRow.insumo_id
    ? (insumos.find(i => i.id === newRow.insumo_id)?.unidade || '')
    : '';

  return (
    <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">

      {/* ── Lote picker ── */}
      {lotes.length > 0 && (
        <LotePicker
          lotes={lotes}
          selectedId={selectedLoteId}
          onSelect={setSelectedLoteId}
          cor={cor}
        />
      )}

      {/* ── Scale notice ── */}
      {selectedLote && isScaled && (
        <div className="rounded-xl px-3 py-2 mb-4 flex items-center gap-2"
          style={{ background: `${cor}0d`, border: `1px solid ${cor}25` }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cor }} />
          <p className="text-[11px] font-semibold" style={{ color: cor }}>
            Doses ajustadas para este lote (fator {fator.toFixed(2)}×)
          </p>
        </div>
      )}

      {/* ── Estado Atual do Ciclo ── */}
      {lc && (
        <div className="card p-4 mb-4" style={{ borderColor: `${cor}30` }}>
          <p className="section-label mb-3">Estado atual do ciclo</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Fase</p>
              {lc.faseAtual ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: getFaseColor(lc.faseIndex).bg, color: getFaseColor(lc.faseIndex).text }}>
                  <Leaf size={11} /> {lc.faseAtual}
                </span>
              ) : <p className="text-[13px] font-bold text-foreground">—</p>}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Dia do ciclo</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>D{lc.diasDecorridos}</p>
            </div>
            {lc.dataTransplante && (
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Transplante (previsto)</p>
                <p className="text-[13px] font-bold text-foreground">{fmtDateBR(lc.dataTransplante)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">1ª Colheita estimada</p>
              <p className="text-[13px] font-bold" style={{ color: lc.prontoParaColheita ? '#16a34a' : cor }}>
                {fmtDateBR(lc.dataPrimeiraProducao)}
              </p>
              {!lc.prontoParaColheita && (
                <p className="text-[11px] text-muted-foreground">{fmtDiasRestantes(lc.diasParaColheita)}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Produção plena estimada</p>
              <p className="text-[13px] font-bold text-foreground">{fmtDateBR(lc.dataProducaoPlena)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Cronograma</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            <span className="font-bold" style={{ color: cor }}>{feitos}</span> de {allEvents.length} etapas concluídas
            {selectedLote && diasDecorridos !== null && (
              <span className="ml-2 text-muted-foreground">· Dia {diasDecorridos} do ciclo</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}>
            <Plus size={13} /> Adicionar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={13} />
          </Button>
        </div>
      </div>

      {/* ── Progress card ── */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-[11px] text-muted-foreground font-medium">Progresso do ciclo</span>
              <span className="text-[11px] font-bold" style={{ color: cor }}>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cor}80, ${cor})` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              />
            </div>
            {selectedLote && (
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Plantio: {formatDate(selectedLote.data_plantio)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  1ª colheita: {lc
                    ? lc.dataPrimeiraProducao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : formatStepDate(selectedLote.data_plantio, cultura.cronograma[cultura.cronograma.length - 1]?.dia || 35)
                  }
                </span>
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-3xl font-black leading-none" style={{ color: cor }}>{feitos}</div>
            <div className="section-label mt-0.5">feitas</div>
          </div>
        </div>
      </div>

      {/* ── Vertical Timeline ── */}
      <div className="flex flex-col">
        {allEvents.map((ev, rowIdx) => {
          const st     = status[ev._id];
          const isDone = st?.status === 'feito';
          const meta   = TIPO_META[ev.tipo] || TIPO_META.manejo;
          const cidx   = ev._custom ? customRows.findIndex((_, i) => `custom_${i}` === ev._id) : -1;
          const isLast = rowIdx === allEvents.length - 1;
          const isConfirming = confirming?.id === ev._id;

          const isPast     = diasDecorridos !== null && diasDecorridos > ev.dia && !isDone;
          const isToday    = diasDecorridos !== null && diasDecorridos === ev.dia && !isDone;
          const isTomorrow = diasDecorridos !== null && ev.dia - diasDecorridos === 1 && !isDone;
          const stepDateStr = selectedLote ? formatStepDate(selectedLote.data_plantio, ev.dia) : null;
          const scaledDose  = ev._noScaleDose ? ev.dose : scaleDose(ev.dose, fator);

          return (
            <motion.div
              key={ev._id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rowIdx * 0.045, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-3 group"
            >
              {/* ── Left: day circle + connector ── */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 48 }}>
                <div
                  className="w-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border"
                  style={{
                    height: stepDateStr ? 56 : 48,
                    ...(isDone
                      ? { background: meta.color, borderColor: meta.color, boxShadow: `0 4px 12px ${meta.color}40` }
                      : isPast
                      ? { background: '#fef2f2', borderColor: '#fca5a5' }
                      : isToday
                      ? { background: meta.color + '25', borderColor: meta.color, boxShadow: `0 0 0 2px ${meta.color}40` }
                      : isTomorrow
                      ? { background: '#eff6ff', borderColor: '#93c5fd', boxShadow: '0 0 0 2px #bfdbfe' }
                      : { background: meta.bg, borderColor: `${meta.color}30` }
                    )
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={20} color="#fff" />
                  ) : (
                    <>
                      <span className="text-[8px] font-black uppercase tracking-widest leading-none"
                        style={{ color: isPast ? '#ef4444' : isTomorrow ? '#2563eb' : meta.color }}>
                        {isPast ? '!' : isToday ? 'HOJE' : isTomorrow ? 'AMHÃ' : 'DIA'}
                      </span>
                      <span className="font-display font-black text-sm leading-none mt-0.5"
                        style={{ color: isPast ? '#ef4444' : isTomorrow ? '#2563eb' : meta.color }}>
                        {ev.dia}
                      </span>
                      {stepDateStr && (
                        <span className="text-[8px] font-bold leading-none mt-0.5"
                          style={{ color: isPast ? '#ef4444' : isTomorrow ? '#2563eb' : meta.color, opacity: 0.75 }}>
                          {stepDateStr}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {!isLast && (
                  <div className="w-0.5 flex-1 mt-1 mb-1 min-h-[20px]"
                    style={{ background: isDone ? `${meta.color}50` : 'hsl(214 20% 88%)' }} />
                )}
              </div>

              {/* ── Right: card ── */}
              <div className={`flex-1 ${!isLast ? 'mb-3' : ''}`}>
                <div
                  className="rounded-2xl overflow-hidden border cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setDescricaoStep(ev)}
                  style={{
                    borderColor: isDone
                      ? `${meta.color}35`
                      : isConfirming
                      ? `${meta.color}60`
                      : isPast
                      ? '#fca5a530'
                      : isToday
                      ? `${meta.color}50`
                      : isTomorrow
                      ? '#93c5fd50'
                      : 'hsl(214 20% 88%)',
                    background: isDone ? meta.bg : isPast ? '#fff5f5' : isTomorrow ? '#f0f9ff' : '#fff',
                    boxShadow: isDone ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Card content */}
                  <div className="px-4 pt-3.5 pb-3">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ background: isDone ? `${meta.color}20` : meta.bg, color: meta.color }}
                        >
                          <span>{meta.emoji}</span>
                          {meta.label}
                        </span>
                        {ev._viveiro && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                            🌱 Viveiro
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isPast && !isDone && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: '#fee2e2', color: '#dc2626' }}>
                            <AlertCircle size={9} /> Pendente
                          </span>
                        )}
                        {isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            🕐 Hoje
                          </span>
                        )}
                        {isTomorrow && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#dbeafe', color: '#2563eb' }}>
                            ↗ Amanhã
                          </span>
                        )}
                        {/* Feature 1: inline remove confirm (shown for ALL steps) */}
                        <AnimatePresence mode="wait">
                          {removingId === ev._id ? (
                            <motion.div
                              key="confirm-remove"
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-[10px] font-bold text-red-600">Remover?</span>
                              <button
                                onClick={e => { e.stopPropagation(); removeStep(ev); }}
                                className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                                style={{ background: '#dc2626' }}
                              >
                                Sim
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setRemovingId(null); }}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 40%)' }}
                              >
                                Não
                              </button>
                            </motion.div>
                          ) : (
                            <motion.button
                              key="trash-btn"
                              whileTap={{ scale: 0.9 }}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                              onClick={e => { e.stopPropagation(); setRemovingId(ev._id); }}
                            >
                              <Trash2 size={12} />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Feature 2: clicking card opens description bottom sheet */}
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={`text-[14px] font-bold leading-snug flex-1 ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      >
                        {ev.etapa}
                      </p>
                      <ChevronRight size={14} className="flex-shrink-0 mt-0.5 opacity-30" style={{ color: meta.color }} />
                    </div>

                    {ev.produto && ev.produto !== '—' && (
                      <p className="text-[12px] text-muted-foreground mt-1.5 flex items-center gap-1 flex-wrap">
                        <span>{ev.produto}</span>
                        {scaledDose && scaledDose !== '—' && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="font-semibold text-foreground">{scaledDose}</span>
                            {isScaled && ev.dose !== '—' && (
                              <span className="text-[10px] text-muted-foreground opacity-60">(base: {ev.dose})</span>
                            )}
                          </>
                        )}
                      </p>
                    )}

                    {ev.forma && ev.forma !== '—' && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{ev.forma}</p>
                    )}
                  </div>

                  {/* Done: date badge strip */}
                  {isDone && st?.data && (
                    <div
                      className="px-4 py-2 flex items-center justify-between"
                      style={{ background: `${meta.color}12`, borderTop: `1px solid ${meta.color}25` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={13} style={{ color: meta.color }} />
                        <span className="text-[13px] font-bold" style={{ color: meta.color }}>
                          {formatDate(st.data)}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground ml-1">concluído</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); undoStep(ev._id); }}
                        className="text-[10px] font-semibold flex items-center gap-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X size={10} /> desfazer
                      </button>
                    </div>
                  )}

                  {/* Inline confirm form */}
                  <AnimatePresence>
                    {isConfirming && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div
                          ref={el => { if (el) confirmFormRefs.current[ev._id] = el; }}
                          className="px-4 py-3 flex flex-col gap-3"
                          style={{ background: `${meta.color}08`, borderTop: `1px solid ${meta.color}25` }}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarDays size={13} style={{ color: meta.color }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                              Data de execução
                            </span>
                          </div>
                          <input
                            type="date"
                            value={confirmDate}
                            onChange={e => setConfirmDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm font-semibold text-foreground bg-white focus:outline-none"
                            style={{ borderColor: `${meta.color}40` }}
                          />

                          {/* ── Colheita confirm fields ── */}
                          {confirming?.tipo === 'colheita' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold" style={{ color: meta.color }}>Colheita realizada?</span>
                                <Toggle
                                  enabled={harvestData.enabled}
                                  onToggle={() => setHarvestData(h => ({ ...h, enabled: !h.enabled }))}
                                  color={meta.color}
                                />
                              </div>
                              <AnimatePresence>
                                {harvestData.enabled && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
                                    style={{ overflow: 'hidden' }}
                                    className="space-y-2"
                                  >
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade colhida</label>
                                      <div className="flex gap-2 mt-1">
                                        <input
                                          type="number" min="0" step="0.01"
                                          value={harvestData.qtd}
                                          onChange={e => setHarvestData(h => ({ ...h, qtd: e.target.value }))}
                                          placeholder="0"
                                          className="flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none bg-white"
                                          style={{ borderColor: `${meta.color}40` }}
                                        />
                                        <select
                                          value={harvestData.unidade}
                                          onChange={e => setHarvestData(h => ({ ...h, unidade: e.target.value }))}
                                          className="rounded-xl border px-2 py-2 text-[13px] outline-none bg-white"
                                          style={{ borderColor: `${meta.color}40` }}
                                        >
                                          <option value="kg">kg</option>
                                          <option value="caixas">caixas</option>
                                          <option value="dúzias">dúzias</option>
                                          <option value="unidades">unidades</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold" style={{ color: meta.color }}>Polpa produzida?</span>
                                      <Toggle
                                        enabled={harvestData.polpa}
                                        onToggle={() => setHarvestData(h => ({ ...h, polpa: !h.polpa }))}
                                        color={meta.color}
                                      />
                                    </div>
                                    <AnimatePresence>
                                      {harvestData.polpa && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                                          style={{ overflow: 'hidden' }}
                                        >
                                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade de polpa</label>
                                          <div className="flex gap-2 mt-1">
                                            <input
                                              type="number" min="0" step="0.01"
                                              value={harvestData.qtdPolpa}
                                              onChange={e => setHarvestData(h => ({ ...h, qtdPolpa: e.target.value }))}
                                              placeholder="0"
                                              className="flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none bg-white"
                                              style={{ borderColor: `${meta.color}40` }}
                                            />
                                            <select
                                              value={harvestData.unidadePolpa}
                                              onChange={e => setHarvestData(h => ({ ...h, unidadePolpa: e.target.value }))}
                                              className="rounded-xl border px-2 py-2 text-[13px] outline-none bg-white"
                                              style={{ borderColor: `${meta.color}40` }}
                                            >
                                              <option value="kg">kg</option>
                                              <option value="L">L</option>
                                            </select>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* ── Stock deduction (adubo/foliar) ── */}
                          {(confirming?.tipo === 'adubo' || confirming?.tipo === 'foliar') && insumos.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold" style={{ color: meta.color }}>Debitar do estoque</span>
                                <Toggle
                                  enabled={stockDebit.enabled}
                                  onToggle={() => setStockDebit(s => ({ ...s, enabled: !s.enabled }))}
                                  color={meta.color}
                                />
                              </div>

                              {stockDebit.enabled && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
                                  style={{ overflow: 'hidden' }}
                                  className="space-y-2"
                                >
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insumo</label>
                                    <select
                                      value={stockDebit.insumoId}
                                      onChange={e => setStockDebit(s => ({ ...s, insumoId: e.target.value }))}
                                      className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
                                      style={{ background: 'white', borderColor: `${meta.color}40` }}
                                    >
                                      <option value="">Selecionar insumo…</option>
                                      {insumos.map(i => (
                                        <option key={i.id} value={i.id}>
                                          {i.nome} ({i.quantidade} {i.unidade})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      Quantidade {stockDebit.insumoId ? `(${insumos.find(i => i.id === stockDebit.insumoId)?.unidade || ''})` : ''}
                                    </label>
                                    <input
                                      type="number" min="0.01" step="0.01"
                                      value={stockDebit.quantidade}
                                      onChange={e => setStockDebit(s => ({ ...s, quantidade: e.target.value }))}
                                      className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none"
                                      style={{ background: 'white', borderColor: `${meta.color}40` }}
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setConfirming(null);
                                setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
                                setHarvestData({ enabled: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });
                              }}
                              className="flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors"
                              style={{ borderColor: 'hsl(214 20% 88%)', color: 'hsl(215 16% 45%)' }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => confirmStep(ev._id)}
                              className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white transition-colors"
                              style={{ background: meta.color }}
                            >
                              ✓ Confirmar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA button */}
                  {!isDone && !isConfirming && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      onClick={e => {
                        e.stopPropagation();
                        setConfirmDate(getDefaultConfirmDate(ev.dia));
                        setConfirming({ id: ev._id, etapa: ev.etapa, tipo: ev.tipo });
                        setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
                        setHarvestData({
                          enabled: ev.tipo === 'colheita',
                          qtd: '', unidade: 'kg',
                          polpa: false, qtdPolpa: '', unidadePolpa: 'kg'
                        });
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold transition-colors"
                      style={{
                        background: isPast ? '#fee2e215' : 'hsl(210 16% 97%)',
                        color: isPast ? '#dc2626' : 'hsl(215 16% 42%)',
                        borderTop: '1px solid hsl(214 20% 91%)',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Circle size={13} />
                        Marcar como concluído
                      </span>
                      <ChevronRight size={13} className="opacity-50" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Add Dialog ── */}
      <Dialog open={addDialog} onOpenChange={o => {
        if (!o) {
          setAddDialog(false);
          setAddHarvest({ jaRealizada: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova etapa</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">

            {/* ── Dia + Tipo ── */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24">
                <Label>Dia</Label>
                <Input
                  type="number"
                  value={newRow.dia}
                  onChange={e => {
                    const dia = e.target.value;
                    const prevista = computeDataPrevista(dia);
                    setNewRow(r => ({ ...r, dia, dataPrevista: prevista }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label>Tipo</Label>
                <Select value={newRow.tipo} onValueChange={v => setNewRow(r => ({ ...r, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_META[t].emoji} {TIPO_META[t].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Etapa ── */}
            <div className="flex flex-col gap-1">
              <Label>Etapa *</Label>
              <Input value={newRow.etapa} onChange={e => setNewRow(r => ({ ...r, etapa: e.target.value }))} />
            </div>

            {/* ── colheita type ── */}
            {newRow.tipo === 'colheita' && (
              <>
                {/* Data prevista */}
                <div className="flex flex-col gap-1">
                  <Label>Data prevista</Label>
                  <input
                    type="date"
                    value={newRow.dataPrevista}
                    onChange={e => {
                      const isoDate = e.target.value;
                      const dia = computeDiaFromDate(isoDate);
                      setNewRow(r => ({ ...r, dataPrevista: isoDate, dia: dia !== '' ? String(dia) : r.dia }));
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {!selectedLote && (
                    <p className="text-[11px] text-muted-foreground">Selecione um lote para sincronização automática de datas.</p>
                  )}
                </div>

                {/* Forma / Observações */}
                <div className="flex flex-col gap-1">
                  <Label>Observações</Label>
                  <textarea
                    value={newRow.forma}
                    onChange={e => setNewRow(r => ({ ...r, forma: e.target.value }))}
                    rows={2}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {/* Registrar como já realizada */}
                <div className="space-y-2 rounded-xl border border-input p-3"
                  style={{ background: 'hsl(4 80% 98%)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-foreground">Registrar como já realizada?</span>
                    <Toggle
                      enabled={addHarvest.jaRealizada}
                      onToggle={() => setAddHarvest(h => ({ ...h, jaRealizada: !h.jaRealizada }))}
                      color="#dc2626"
                    />
                  </div>
                  <AnimatePresence>
                    {addHarvest.jaRealizada && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
                        style={{ overflow: 'hidden' }}
                        className="space-y-2 pt-1"
                      >
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade colhida</label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              type="number" min="0" step="0.01"
                              value={addHarvest.qtd}
                              onChange={e => setAddHarvest(h => ({ ...h, qtd: e.target.value }))}
                              placeholder="0"
                              className="flex-1"
                            />
                            <select
                              value={addHarvest.unidade}
                              onChange={e => setAddHarvest(h => ({ ...h, unidade: e.target.value }))}
                              className="rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none"
                            >
                              <option value="kg">kg</option>
                              <option value="caixas">caixas</option>
                              <option value="dúzias">dúzias</option>
                              <option value="unidades">unidades</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-foreground">Polpa produzida?</span>
                          <Toggle
                            enabled={addHarvest.polpa}
                            onToggle={() => setAddHarvest(h => ({ ...h, polpa: !h.polpa }))}
                            color="#dc2626"
                          />
                        </div>
                        <AnimatePresence>
                          {addHarvest.polpa && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade de polpa</label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={addHarvest.qtdPolpa}
                                  onChange={e => setAddHarvest(h => ({ ...h, qtdPolpa: e.target.value }))}
                                  placeholder="0"
                                  className="flex-1"
                                />
                                <select
                                  value={addHarvest.unidadePolpa}
                                  onChange={e => setAddHarvest(h => ({ ...h, unidadePolpa: e.target.value }))}
                                  className="rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none"
                                >
                                  <option value="kg">kg</option>
                                  <option value="L">L</option>
                                </select>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {/* ── adubo / foliar / aplicacao type ── */}
            {isInsumeTipo(newRow.tipo) && (
              <>
                {/* Data prevista */}
                <div className="flex flex-col gap-1">
                  <Label>Data prevista</Label>
                  <input
                    type="date"
                    value={newRow.dataPrevista}
                    onChange={e => {
                      const isoDate = e.target.value;
                      const dia = computeDiaFromDate(isoDate);
                      setNewRow(r => ({ ...r, dataPrevista: isoDate, dia: dia !== '' ? String(dia) : r.dia }));
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {!selectedLote && (
                    <p className="text-[11px] text-muted-foreground">Selecione um lote para sincronização automática de datas.</p>
                  )}
                </div>

                {/* Insumo dropdown */}
                {insumos.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label>Vincular a insumo do estoque (opcional)</Label>
                    <select
                      value={newRow.insumo_id}
                      onChange={e => setNewRow(r => ({ ...r, insumo_id: e.target.value }))}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Nenhum</option>
                      {insumos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} {i.unidade})</option>)}
                    </select>
                  </div>
                )}

                {/* Dose with unit */}
                <div className="flex gap-3 items-end">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label>
                      Dose {selectedInsumoUnit ? `(${selectedInsumoUnit})` : ''}
                    </Label>
                    <Input
                      value={newRow.dose}
                      onChange={e => setNewRow(r => ({ ...r, dose: e.target.value }))}
                      placeholder={selectedInsumoUnit ? `ex: 2 ${selectedInsumoUnit}` : 'ex: 2 kg/100L'}
                    />
                  </div>
                </div>

                {/* Produto */}
                <div className="flex flex-col gap-1">
                  <Label>Produto</Label>
                  <Input value={newRow.produto} onChange={e => setNewRow(r => ({ ...r, produto: e.target.value }))} />
                </div>

                {/* Forma */}
                <div className="flex flex-col gap-1">
                  <Label>Forma de aplicação</Label>
                  <textarea
                    value={newRow.forma}
                    onChange={e => setNewRow(r => ({ ...r, forma: e.target.value }))}
                    rows={2}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </>
            )}

            {/* ── plantio / manejo / especial type ── */}
            {(newRow.tipo === 'plantio' || newRow.tipo === 'manejo' || newRow.tipo === 'especial') && (
              <>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label>Produto</Label>
                    <Input value={newRow.produto} onChange={e => setNewRow(r => ({ ...r, produto: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1 w-28">
                    <Label>Dose</Label>
                    <Input value={newRow.dose} onChange={e => setNewRow(r => ({ ...r, dose: e.target.value }))} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Forma de aplicação</Label>
                  <textarea
                    value={newRow.forma}
                    onChange={e => setNewRow(r => ({ ...r, forma: e.target.value }))}
                    rows={2}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </>
            )}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialog(false);
              setAddHarvest({ jaRealizada: false, qtd: '', unidade: 'kg', polpa: false, qtdPolpa: '', unidadePolpa: 'kg' });
            }}>
              Cancelar
            </Button>
            <Button
              disabled={!newRow.etapa}
              onClick={handleAddRow}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Feature 2: Bottom sheet — step description ──
           Rendered via createPortal to escape any CSS transform ancestor
           (Framer Motion tab wrapper uses willChange: transform which would
            break position:fixed without portaling to document.body)         */}
      {createPortal(
        <AnimatePresence>
          {descricaoStep && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex flex-col justify-end"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
              onClick={() => setDescricaoStep(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="relative rounded-t-3xl p-6 pb-10"
                style={{ background: 'white', maxHeight: '60vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

                {/* Tipo badge */}
                {(() => {
                  const m = TIPO_META[descricaoStep.tipo] || TIPO_META.manejo;
                  return (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
                      style={{ background: m.bg, color: m.color }}
                    >
                      {m.emoji} {m.label}
                    </span>
                  );
                })()}

                {/* Nome */}
                <h3 className="font-display text-[17px] font-bold text-foreground mb-3">
                  {descricaoStep.etapa}
                </h3>

                {/* Descrição */}
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  {descricaoStep.descricao || 'Sem descrição disponível para esta etapa.'}
                </p>

                {/* Fechar */}
                <button
                  onClick={() => setDescricaoStep(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full"
                  style={{ background: 'hsl(210 16% 93%)' }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
