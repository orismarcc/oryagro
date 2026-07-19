import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, X, DollarSign, CheckCircle2, AlertCircle, Wheat, TrendingUp } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes, loadAllColheitaEventos } from '../hooks/useSupabaseSync';
import { cacheGet, cacheSet } from '../hooks/useOfflineCache';
import { supabase } from '../lib/supabase';
import { updateParcela } from '../hooks/useCompradores';
import { useCronogramaStatusBatch, makeStableId, makeCustomId } from '../hooks/useCronogramaSync';

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfWeek(d) {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatDatePtBR(iso) {
  if (!iso) return '';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

const TIPO_COLOR = {
  plantio:    '#16a34a',
  adubo:      '#d97706',
  foliar:     '#0891b2',
  colheita:   '#7c3aed',
  manejo:     '#6b7280',
  especial:   '#dc2626',
  aplicacao:  '#b45309',
  financeiro: '#2563eb',
};

const TIPO_LABEL = {
  plantio: 'Plantio', adubo: 'Adubação', foliar: 'Foliar',
  colheita: 'Colheita', manejo: 'Manejo', especial: 'Especial',
  aplicacao: 'Aplicação',
};

const TIPO_DESC = {
  plantio:   'Momento de transplantio das mudas para o campo definitivo.',
  adubo:     'Aplicação de fertilizante para suprir as necessidades nutricionais da cultura.',
  foliar:    'Aplicação via foliar para correção nutricional ou controle fitossanitário.',
  colheita:  'Colheita prevista do produto. Verificar ponto de maturação antes de iniciar.',
  manejo:    'Atividade de manejo e manutenção regular do cultivo.',
  especial:  'Atividade especial definida no cronograma da cultura.',
  aplicacao: 'Aplicação de produto fitossanitário ou regulador.',
};

function cacheGetTimestamp(key) {
  try {
    const raw = localStorage.getItem('offline_cache_' + key);
    if (!raw) return null;
    return JSON.parse(raw).ts || null;
  } catch { return null; }
}

/** Resolve o shift de viveiro a partir do metodo_propagacao do lote */
function resolveShift(lote, cultura) {
  // 1. Tentar pelo método salvo no banco
  if (lote.metodo_propagacao && cultura?.metodosPropagacao) {
    const m = cultura.metodosPropagacao.find(x => x.key === lote.metodo_propagacao);
    if (m) return m.diasViveiro || 0;
  }
  // 2. Fallback: localStorage (retrocompatível)
  const usaMudas = localStorage.getItem(`lote_mudas_${lote.id}`) === '1';
  return usaMudas ? 15 : 0;
}

/**
 * Resolve the status (done/date) for a specific step key.
 * Uses the Supabase-loaded statusMap passed in — no localStorage read here.
 */
function resolveStepStatus(statusMap, stepKey) {
  return statusMap?.[stepKey] || null;
}

/**
 * Gera atividades de um lote para todos os dias do cronograma.
 * @param {object} lote
 * @param {object} cultura
 * @param {object} statusMap    — { [stepId]: { status, data } } from Supabase
 * @param {Array}  customRowsForLote — custom rows from Supabase (may be empty)
 */
function getAtividadesLote(lote, cultura, statusMap = {}, customRowsForLote = []) {
  if (!cultura) return [];
  const plantioDate = new Date(lote.data_plantio + 'T12:00:00');
  const shift = resolveShift(lote, cultura);

  // Resolve the propagation method object for this lote
  const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
    ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
    : null;

  const activities = [];

  // 1. Viveiro steps (from propagation method)
  if (metodoObj?.etapasViveiro) {
    metodoObj.etapasViveiro.forEach((etapa, i) => {
      const dataAtividade = addDays(plantioDate, etapa.dia);
      const stepKey = makeStableId('viveiro', etapa.etapa);
      const stepStatus = resolveStepStatus(statusMap, stepKey);
      if (stepStatus?.status === 'removida') return;
      const dataStr = (stepStatus?.status === 'feito' && stepStatus?.data)
        ? stepStatus.data
        : isoDate(dataAtividade);
      activities.push({
        id: `${lote.id}_viveiro_${i}`,
        loteId: lote.id,
        loteNome: lote.nome,
        culturaId: cultura.id,
        culturaNome: cultura.nome,
        culturaEmoji: cultura.emoji,
        culturaCor: cultura.cor,
        data: dataStr,
        dataPlanejada: isoDate(dataAtividade),
        dia: etapa.dia,
        etapa: etapa.etapa,
        produto: etapa.produto,
        dose: etapa.dose,
        tipo: etapa.tipo || 'manejo',
        isCustom: false,
        isViveiro: true,
        done: stepStatus?.status === 'feito',
      });
    });
  }

  // 2. Static steps from cultura.cronograma
  if (cultura.cronograma) {
    cultura.cronograma.forEach((etapa, i) => {
      const dataAtividade = addDays(plantioDate, etapa.dia + shift);
      const stepKey = makeStableId('default', etapa.etapa);
      const stepStatus = resolveStepStatus(statusMap, stepKey);
      if (stepStatus?.status === 'removida') return;
      const dataStr = (stepStatus?.status === 'feito' && stepStatus?.data)
        ? stepStatus.data
        : isoDate(dataAtividade);
      activities.push({
        id: `${lote.id}_static_${i}`,
        loteId: lote.id,
        loteNome: lote.nome,
        culturaId: cultura.id,
        culturaNome: cultura.nome,
        culturaEmoji: cultura.emoji,
        culturaCor: cultura.cor,
        data: dataStr,
        dataPlanejada: isoDate(dataAtividade),
        dia: etapa.dia,
        etapa: etapa.etapa,
        produto: etapa.produto,
        dose: etapa.dose,
        tipo: etapa.tipo || 'manejo',
        isCustom: false,
        isViveiro: false,
        done: stepStatus?.status === 'feito',
      });
    });
  }

  // 3. Custom rows — from Supabase (passed in), NOT from localStorage
  const customRows = customRowsForLote || [];
  customRows.forEach((row, i) => {
    // Use hash-based ID (matches CronogramaTimeline and buildStatusFromDbRows)
    const stepKeyCustom = row._stableId || makeCustomId(row.etapa, row.dia);
    const stepStatus = resolveStepStatus(statusMap, stepKeyCustom);
    if (stepStatus?.status === 'removida') return;

    let dataStr;
    if (row.dataPrevista) {
      dataStr = row.dataPrevista;
    } else if (row.dia !== '' && row.dia !== null && row.dia !== undefined) {
      const diaNum = parseInt(row.dia, 10);
      if (!isNaN(diaNum)) {
        dataStr = isoDate(addDays(plantioDate, diaNum + shift));
      }
    }
    if (!dataStr) return;
    const doneData = (stepStatus?.status === 'feito' && stepStatus?.data) ? stepStatus.data : null;
    activities.push({
      id: `${lote.id}_${stepKeyCustom}`,
      loteId: lote.id,
      loteNome: lote.nome,
      culturaId: cultura.id,
      culturaNome: cultura.nome,
      culturaEmoji: cultura.emoji,
      culturaCor: cultura.cor,
      data: doneData || dataStr,
      dataPlanejada: dataStr,
      dia: row.dia,
      etapa: row.etapa || 'Atividade personalizada',
      produto: row.produto || '',
      dose: row.dose || '',
      tipo: row.tipo || 'manejo',
      isCustom: true,
      isViveiro: false,
      done: stepStatus?.status === 'feito',
    });
  });

  return activities;
}

/** AtividadeCard — clickable to open popup */
function AtividadeCard({ ativ, isHoje, onClick }) {
  const cor = ativ.done ? '#16a34a' : (TIPO_COLOR[ativ.tipo] || '#6b7280');
  const dataDiferente = ativ.done && ativ.dataPlanejada && ativ.data !== ativ.dataPlanejada;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-xl mb-2 cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        background: ativ.done ? '#f0fdf4' : (isHoje ? `${cor}10` : 'white'),
        border: `1px solid ${ativ.done ? '#bbf7d0' : (isHoje ? cor+'40' : 'hsl(214 20% 91%)')}`,
        opacity: ativ.done ? 0.75 : 1,
      }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: `${ativ.culturaCor || '#16a34a'}15` }}>
        {ativ.done ? '✓' : ativ.culturaEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[12px] font-bold ${ativ.done ? 'line-through text-gray-400' : 'text-foreground'}`}>{ativ.etapa}</span>
          {!ativ.done && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: `${cor}18`, color: cor }}>
              {TIPO_LABEL[ativ.tipo] || ativ.tipo}
            </span>
          )}
          {ativ.done && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: '#dcfce7', color: '#16a34a' }}>
              ✓ concluída
            </span>
          )}
          {ativ.isViveiro && !ativ.done && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: '#eff6ff', color: '#2563eb' }}>
              viveiro
            </span>
          )}
          {ativ.isCustom && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: 'hsl(263 80% 95%)', color: '#7c3aed' }}>
              + adicionada
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {ativ.loteNome} · {ativ.culturaNome}
          {ativ.produto && ativ.produto !== '—' ? ` · ${ativ.produto}` : ''}
        </p>
        {dataDiferente && (
          <p className="text-[10px] text-blue-500 mt-0.5">
            Planejado: {ativ.dataPlanejada.split('-').reverse().join('/')} → Realizado: {ativ.data.split('-').reverse().join('/')}
          </p>
        )}
        {ativ.dose && ativ.dose !== '—' && !ativ.done && (
          <p className="text-[10px] text-muted-foreground">{ativ.dose}</p>
        )}
      </div>
    </motion.div>
  );
}

/** Step detail bottom-sheet popup */
function AtividadePopup({ ativ, onClose }) {
  const cor = TIPO_COLOR[ativ.tipo] || '#6b7280';
  const desc = TIPO_DESC[ativ.tipo] || 'Atividade prevista no cronograma de cultivo.';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40"
      />
      {/* Bottom sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl bg-white max-h-[80vh] overflow-y-auto p-5"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(210 16% 93%)' }}
        >
          <X size={16} color="hsl(215 20% 35%)" />
        </button>

        {/* Emoji + etapa */}
        <div className="flex items-center gap-3 mb-4 pr-10">
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{ativ.culturaEmoji}</span>
          <div>
            <p className="text-[18px] font-extrabold text-foreground leading-tight">{ativ.etapa}</p>
            <span
              className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1"
              style={{ background: `${cor}18`, color: cor }}
            >
              {TIPO_LABEL[ativ.tipo] || ativ.tipo}
            </span>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-2.5 mb-4">
          <InfoRow label="Lote" value={ativ.loteNome} />
          <InfoRow label="Cultura" value={ativ.culturaNome} />
          <InfoRow label="Data prevista" value={formatDatePtBR(ativ.dataPlanejada)} />
          {ativ.done && ativ.data && (
            <InfoRow label="Data realizada" value={formatDatePtBR(ativ.data)} />
          )}
          {ativ.dia !== undefined && ativ.dia !== null && ativ.dia !== '' && (
            <InfoRow label="Dia do ciclo" value={`Dia ${ativ.dia}`} />
          )}
          {ativ.produto && ativ.produto !== '—' && (
            <InfoRow label="Produto" value={ativ.produto} />
          )}
          {ativ.dose && ativ.dose !== '—' && (
            <InfoRow label="Dose" value={ativ.dose} />
          )}
        </div>

        {/* Description block */}
        <div className="rounded-xl p-3.5 mb-4"
          style={{ background: `${cor}0d`, border: `1px solid ${cor}25` }}>
          <p className="text-[12px] text-foreground leading-relaxed">{desc}</p>
          {ativ.isViveiro && (
            <p className="text-[11px] mt-2 text-blue-600">📍 Esta etapa faz parte da fase de viveiro.</p>
          )}
          {ativ.isCustom && (
            <p className="text-[11px] mt-2" style={{ color: '#7c3aed' }}>✏️ Atividade personalizada adicionada manualmente.</p>
          )}
        </div>

        {/* Status badge */}
        {ativ.done ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: '#dcfce7' }}>
            <span className="text-[13px] font-bold text-green-700">✓ Atividade concluída</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: `${cor}10` }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
            <span className="text-[12px] font-semibold" style={{ color: cor }}>Aguardando execução</span>
          </div>
        )}
      </motion.div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Sumário mensal — card abaixo do grid */
function SumarioMensal({ monthStart, atividadesPorDia, today, colheitaEventos, lotes }) {
  const m = monthStart.getMonth();
  const y = monthStart.getFullYear();

  // Collect all activities in the month (excl. parcelas financeiras)
  const atvsDoMes = useMemo(() => {
    const result = [];
    Object.entries(atividadesPorDia).forEach(([iso, arr]) => {
      const d = new Date(iso + 'T12:00:00');
      if (d.getMonth() !== m || d.getFullYear() !== y) return;
      arr.forEach(a => { if (!a.isParcela) result.push(a); });
    });
    return result;
  }, [atividadesPorDia, m, y]);

  const total      = atvsDoMes.length;
  const concluidas = atvsDoMes.filter(a => a.done).length;
  const atrasadas  = atvsDoMes.filter(a => !a.done && a.dataPlanejada && a.dataPlanejada < today).length;

  // Harvest kg from plantio_eventos (tipo='colheita') in this month
  const colheitaKg = useMemo(() => {
    return (colheitaEventos || []).reduce((sum, ev) => {
      if (!ev.data) return sum;
      const d = new Date(ev.data + 'T12:00:00');
      if (d.getMonth() !== m || d.getFullYear() !== y) return sum;
      return sum + (parseFloat(ev.quantidade) || 0);
    }, 0);
  }, [colheitaEventos, m, y]);

  // Estimated revenue: for each lote that had a harvest event this month,
  // use its cultura's venda.precoUnitario (per kg where unidade='kg', else skip)
  const receitaEstimada = useMemo(() => {
    if (!colheitaEventos || !lotes) return 0;
    const loteById = Object.fromEntries(lotes.map(l => [l.id, l]));
    return (colheitaEventos).reduce((sum, ev) => {
      if (!ev.data) return sum;
      const d = new Date(ev.data + 'T12:00:00');
      if (d.getMonth() !== m || d.getFullYear() !== y) return sum;
      const kg = parseFloat(ev.quantidade) || 0;
      if (!kg) return sum;
      const lote = loteById[ev.plantio_id];
      if (!lote) return sum;
      const cultura = CULTURAS[lote.cultura_id];
      const preco = cultura?.venda?.precoUnitario || 0;
      return sum + kg * preco;
    }, 0);
  }, [colheitaEventos, lotes, m, y]);

  if (total === 0 && colheitaKg === 0) return null;

  return (
    <div
      className="mt-5 rounded-2xl p-4"
      style={{ background: 'hsl(160 60% 97%)', border: '1px solid hsl(160 60% 85%)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Resumo do mês
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Atividades */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'hsl(210 16% 92%)' }}>
            <CalendarDays size={14} color="hsl(215 20% 35%)" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold text-foreground leading-none">{total}</p>
            <p className="text-[10px] text-muted-foreground">atividade{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* Concluídas */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#dcfce7' }}>
            <CheckCircle2 size={14} color="#16a34a" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-none" style={{ color: '#16a34a' }}>{concluidas}</p>
            <p className="text-[10px] text-muted-foreground">concluída{concluidas !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* Atrasadas */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: atrasadas > 0 ? '#fee2e2' : 'hsl(210 16% 92%)' }}>
            <AlertCircle size={14} color={atrasadas > 0 ? '#dc2626' : 'hsl(215 20% 55%)'} />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-none"
              style={{ color: atrasadas > 0 ? '#dc2626' : 'hsl(215 20% 45%)' }}>{atrasadas}</p>
            <p className="text-[10px] text-muted-foreground">atrasada{atrasadas !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* Colheita kg */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#f3e8ff' }}>
            <Wheat size={14} color="#7c3aed" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-none" style={{ color: '#7c3aed' }}>
              {colheitaKg > 0 ? (colheitaKg % 1 === 0 ? colheitaKg : colheitaKg.toFixed(1)) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">kg colhidos</p>
          </div>
        </div>
      </div>

      {/* Receita estimada — full width row */}
      {receitaEstimada > 0 && (
        <div className="mt-3 pt-3 flex items-center gap-2.5"
          style={{ borderTop: '1px solid hsl(160 60% 85%)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#dbeafe' }}>
            <TrendingUp size={14} color="#2563eb" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Receita estimada (colheitas registradas)</p>
            <p className="text-[16px] font-extrabold leading-none mt-0.5" style={{ color: '#2563eb' }}>
              {receitaEstimada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Month grid view */
function MonthView({ monthStart, atividadesPorDia, today, selectedDay, setSelectedDay, onAtivClick, colheitaEventos, lotes }) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();

  // Build all cell dates: leading days from prev month + current month + trailing days to fill 6 rows
  const firstCell = startOfWeek(startOfMonth(monthStart));
  // Always render 6 rows (42 cells) for stable grid height
  const cells = Array.from({ length: 42 }, (_, i) => addDays(firstCell, i));

  const selectedAtivs = selectedDay ? (atividadesPorDia[selectedDay] || []) : [];

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_PT.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden"
        style={{ background: 'hsl(214 20% 88%)' }}>
        {cells.map(cell => {
          const iso = isoDate(cell);
          const inMonth = cell.getMonth() === month;
          const isToday = iso === today;
          const isSelected = iso === selectedDay;
          const ativs = atividadesPorDia[iso] || [];
          const dots = ativs.slice(0, 3);
          const extra = ativs.length - 3;

          return (
            <button
              key={iso}
              onClick={() => setSelectedDay(isSelected ? null : iso)}
              className="relative flex flex-col items-start p-1 min-h-[72px] transition-colors"
              style={{
                background: isSelected
                  ? 'hsl(160 84% 95%)'
                  : isToday
                  ? 'hsl(160 84% 97%)'
                  : 'white',
                opacity: inMonth ? 1 : 1,
              }}
            >
              {/* Day number */}
              <span
                className="text-[11px] font-bold leading-none mb-1 w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0"
                style={
                  isToday
                    ? { background: '#16a34a', color: 'white' }
                    : {
                        color: inMonth
                          ? (isSelected ? '#16a34a' : 'hsl(215 20% 25%)')
                          : 'hsl(215 16% 70%)',
                        opacity: inMonth ? 1 : 0.4,
                      }
                }
              >
                {cell.getDate()}
              </span>

              {/* Activity pills with label — each pill is clickable to open popup */}
              <div className="flex flex-col gap-[2px] w-full">
                {dots.map((a, idx) => {
                  const bg = a.done ? '#dcfce7' : (TIPO_COLOR[a.tipo] || '#6b7280');
                  const fg = a.done ? '#15803d' : 'white';
                  return (
                    <span
                      key={idx}
                      role="button"
                      onClick={e => { e.stopPropagation(); onAtivClick(a); }}
                      className="block w-full rounded truncate cursor-pointer"
                      style={{
                        background: bg,
                        color: fg,
                        opacity: inMonth ? 1 : 0.35,
                        fontSize: '8px',
                        fontWeight: 700,
                        lineHeight: '13px',
                        padding: '0 2px',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {a.etapa}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span
                    className="text-[8px] font-bold leading-none"
                    style={{ color: inMonth ? 'hsl(215 20% 45%)' : 'hsl(215 16% 70%)', opacity: inMonth ? 1 : 0.4 }}
                  >
                    +{extra}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day activity panel */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-extrabold flex-shrink-0"
                style={
                  selectedDay === today
                    ? { background: 'hsl(157 68% 26%)', color: 'white' }
                    : { background: 'hsl(210 16% 92%)', color: 'hsl(215 20% 20%)' }
                }
              >
                {new Date(selectedDay + 'T12:00:00').getDate()}
              </div>
              <div>
                <p className="text-[12px] font-bold text-foreground leading-none">
                  {selectedDay === today
                    ? 'Hoje'
                    : (() => {
                        const sd = new Date(selectedDay + 'T12:00:00');
                        return `${DIAS_PT[sd.getDay()]}, ${sd.getDate()} ${MESES_PT[sd.getMonth()]} ${sd.getFullYear()}`;
                      })()}
                </p>
                {selectedAtivs.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedAtivs.length} atividade{selectedAtivs.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            {selectedAtivs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-2 py-1">Sem atividades previstas</p>
            ) : (
              selectedAtivs.map(a => (
                <AtividadeCard key={a.id} ativ={a} isHoje={selectedDay === today} onClick={() => onAtivClick(a)} />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly summary card */}
      <SumarioMensal
        monthStart={monthStart}
        atividadesPorDia={atividadesPorDia}
        today={today}
        colheitaEventos={colheitaEventos}
        lotes={lotes}
      />
    </div>
  );
}

export default function CalendarioPage() {
  const [calView, setCalView] = useState('month');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [popupAtiv, setPopupAtiv] = useState(null);
  const [popupParcela, setPopupParcela] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagandoParcela, setPagandoParcela] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  const [colheitaEventos, setColheitaEventos] = useState([]);

  const CACHE_KEY = 'calendario_lotes';

  useEffect(() => {
    // 1. Exibe cache imediatamente se disponível
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      setLotes(cached);
      setLoading(false);
      setCacheTimestamp(cacheGetTimestamp(CACHE_KEY));
    }

    // 2. Busca dados frescos em background
    loadTodosLotes(100)
      .then(data => {
        setLotes(data);
        cacheSet(CACHE_KEY, data);
        setCacheTimestamp(Date.now());
        setLoading(false);
      })
      .catch(() => {
        // Sem internet e sem cache — mantém tela de loading
        if (!cached) setLoading(false);
      });

    // 3. Load harvest events for monthly summary
    loadAllColheitaEventos().then(evs => setColheitaEventos(evs)).catch(() => {});
  }, []);

  // ── Cronograma status from Supabase (source of truth) ───────────────────────
  const loteIds = useMemo(() => lotes.map(l => l.id), [lotes]);
  const { statusByLote, customByLote } = useCronogramaStatusBatch(loteIds);

  // Load parcelas pendentes do mês/semana visível
  const loadParcelas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Calcula intervalo do mês/semana visível (com folga de 1 mês para ambas as views)
    const refDate = calView === 'month' ? monthStart : weekStart;
    const inicio = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    const fim    = new Date(refDate.getFullYear(), refDate.getMonth() + 2, 0);
    const { data } = await supabase
      .from('venda_parcelas')
      .select('*, venda:vendas(plantio_id, comprador:compradores(nome))')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .gte('data_vencimento', isoDate(inicio))
      .lte('data_vencimento', isoDate(fim))
      .order('data_vencimento', { ascending: true });
    setParcelas(data || []);
  }, [calView, monthStart, weekStart]);

  useEffect(() => { loadParcelas(); }, [loadParcelas]);

  const handleMarcarPago = async (parcela) => {
    setPagandoParcela(true);
    const hoje = isoDate(new Date());
    await updateParcela(parcela.id, { status: 'pago', dataPagamento: hoje });
    setParcelas(prev => prev.filter(p => p.id !== parcela.id));
    setPopupParcela(null);
    setPagandoParcela(false);
  };

  const today = isoDate(new Date());

  // Build activity map: { 'YYYY-MM-DD': [ativ, ...] }
  const atividadesPorDia = {};
  lotes.forEach(lote => {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;
    // Pass Supabase-loaded status maps — never read from localStorage here
    getAtividadesLote(lote, cultura, statusByLote[lote.id], customByLote[lote.id]).forEach(a => {
      if (!atividadesPorDia[a.data]) atividadesPorDia[a.data] = [];
      atividadesPorDia[a.data].push(a);
    });
  });
  // Adicionar parcelas pendentes como eventos financeiros (tipo 'financeiro')
  parcelas.forEach(p => {
    const dia = p.data_vencimento;
    if (!atividadesPorDia[dia]) atividadesPorDia[dia] = [];
    const compradorNome = p.venda?.comprador?.nome || 'Comprador';
    atividadesPorDia[dia].push({
      id:         `parcela-${p.id}`,
      tipo:       'financeiro',
      etapa:      `Parcela ${p.numero_parcela} — ${compradorNome}`,
      data:       dia,
      dataPlanejada: dia,
      done:       false,
      isParcela:  true,
      parcelaObj: p,
      valor:      p.valor,
      compradorNome,
    });
  });

  // Week view helpers
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const s = weekDays[0]; const e = weekDays[6];
    return `${s.getDate()} ${MESES_PT[s.getMonth()]} – ${e.getDate()} ${MESES_PT[e.getMonth()]} ${e.getFullYear()}`;
  })();
  const totalWeek = weekDays.reduce((n, d) => n + (atividadesPorDia[isoDate(d)]?.length || 0), 0);

  // Month view helpers
  const monthLabel = `${MESES_PT_FULL[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
  const totalMonth = (() => {
    const m = monthStart.getMonth();
    const y = monthStart.getFullYear();
    return Object.entries(atividadesPorDia).reduce((n, [iso, arr]) => {
      const d = new Date(iso + 'T12:00:00');
      return d.getMonth() === m && d.getFullYear() === y ? n + arr.length : n;
    }, 0);
  })();

  const heroCount = calView === 'month' ? totalMonth : totalWeek;
  const heroLabel = calView === 'month'
    ? `${heroCount} atividade${heroCount !== 1 ? 's' : ''} este mês`
    : `${heroCount} atividade${heroCount !== 1 ? 's' : ''} esta semana`;

  const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : null;
  const isDadosCache = cacheAge !== null && cacheAge > 60 * 60 * 1000; // > 1h

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Propriedade</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Calendário</h1>
        <p className="text-white/50 text-[11px] mt-1">{heroLabel}</p>
        {isDadosCache && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold mb-3"
            style={{ background: 'hsl(43 90% 93%)', color: 'hsl(38 70% 32%)', border: '1px solid hsl(38 92% 46% / 0.25)' }}
          >
            <span>⏱</span>
            Dados do cache · atualizado {Math.round(cacheAge / 3600000)}h atrás
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 mt-3 w-fit rounded-xl p-0.5"
          style={{ background: 'rgba(255,255,255,0.12)' }}>
          {['month', 'week'].map(v => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className="px-4 py-1.5 rounded-[10px] text-[12px] font-bold transition-all"
              style={calView === v
                ? { background: 'white', color: 'hsl(157 68% 26%)' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.7)' }}
            >
              {v === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => calView === 'month'
              ? setMonthStart(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              : setWeekStart(w => addDays(w, -7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <ChevronLeft size={16} color="white" />
          </button>
          <span className="flex-1 text-center text-[12px] font-semibold text-white/80">
            {calView === 'month' ? monthLabel : weekLabel}
          </span>
          <button
            onClick={() => calView === 'month'
              ? setMonthStart(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              : setWeekStart(w => addDays(w, 7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <ChevronRight size={16} color="white" />
          </button>
        </div>

        {/* Week day strip (week view only) */}
        {calView === 'week' && (
          <div className="flex gap-1 mt-3">
            {weekDays.map(d => {
              const iso = isoDate(d);
              const count = atividadesPorDia[iso]?.length || 0;
              const isToday = iso === today;
              return (
                <button key={iso} onClick={() => {
                  const el = document.getElementById(`day-${iso}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                  className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all"
                  style={{ background: isToday ? 'rgba(255,255,255,0.28)' : count > 0 ? 'rgba(255,255,255,0.10)' : 'transparent' }}>
                  <span className="text-[9px] text-white/60 font-semibold">{DIAS_PT[d.getDay()]}</span>
                  <span className="text-[14px] font-bold text-white leading-tight">{d.getDate()}</span>
                  {count > 0 && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: isToday ? 'white' : 'rgba(255,255,255,0.5)' }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-32 max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : lotes.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-[13px] text-muted-foreground">Nenhum lote cadastrado ainda.</p>
            <p className="text-[11px] text-muted-foreground mt-1">Adicione um lote na tela Início para ver o calendário.</p>
          </div>
        ) : calView === 'month' ? (
          <MonthView
            monthStart={monthStart}
            atividadesPorDia={atividadesPorDia}
            today={today}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onAtivClick={a => a.isParcela ? setPopupParcela(a.parcelaObj) : setPopupAtiv(a)}
            colheitaEventos={colheitaEventos}
            lotes={lotes}
          />
        ) : (
          weekDays.map(d => {
            const iso = isoDate(d);
            const ativs = atividadesPorDia[iso] || [];
            const isToday = iso === today;
            const isPast = iso < today;
            return (
              <div key={iso} id={`day-${iso}`} className="mb-5">
                <div className="flex items-center gap-2 mb-2 sticky top-14 z-10 py-1"
                  style={{ background: 'hsl(210 16% 97%)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold"
                    style={isToday
                      ? { background: 'hsl(157 68% 26%)', color: 'white' }
                      : { background: 'hsl(210 16% 92%)', color: isPast ? 'hsl(215 16% 60%)' : 'hsl(215 20% 20%)' }}>
                    {d.getDate()}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-foreground leading-none">
                      {isToday ? 'Hoje' : `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]}`}
                    </p>
                    {ativs.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">{ativs.length} atividade{ativs.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
                {ativs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground px-2 py-1">Sem atividades previstas</p>
                ) : (
                  ativs.map(a => (
                    <AtividadeCard
                      key={a.id} ativ={a} isHoje={isToday}
                      onClick={() => a.isParcela ? setPopupParcela(a.parcelaObj) : setPopupAtiv(a)}
                    />
                  ))
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Step detail popup */}
      <AnimatePresence>
        {popupAtiv && (
          <AtividadePopup ativ={popupAtiv} onClose={() => setPopupAtiv(null)} />
        )}
      </AnimatePresence>

      {/* Parcela payment popup */}
      <AnimatePresence>
        {popupParcela && (
          <>
            <motion.div
              key="parcela-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPopupParcela(null)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              key="parcela-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl bg-white p-5"
            >
              <button
                onClick={() => setPopupParcela(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'hsl(210 16% 93%)' }}
              ><X size={16} color="hsl(215 20% 35%)" /></button>

              <div className="flex items-center gap-3 mb-4 pr-10">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: '#dbeafe' }}>
                  <DollarSign size={20} color="#2563eb" />
                </div>
                <div>
                  <p className="text-[18px] font-extrabold text-foreground leading-tight">
                    Parcela {popupParcela.numero_parcela}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {popupParcela.venda?.comprador?.nome || 'Comprador não vinculado'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <InfoRow label="Valor" value={popupParcela.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <InfoRow label="Vencimento" value={formatDatePtBR(popupParcela.data_vencimento)} />
                <InfoRow label="Status" value={popupParcela.data_vencimento < isoDate(new Date()) ? '⚠️ Vencida' : '⏳ Pendente'} />
              </div>

              <button
                onClick={() => handleMarcarPago(popupParcela)}
                disabled={pagandoParcela}
                className="w-full py-3 rounded-2xl text-white font-bold text-[14px] transition-opacity disabled:opacity-60"
                style={{ background: 'hsl(157 68% 26%)' }}
              >
                {pagandoParcela ? 'Registrando...' : '✓ Marcar como pago (hoje)'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
