import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes } from '../hooks/useSupabaseSync';

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfWeek(d) {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r;
}

const TIPO_COLOR = {
  plantio:  '#16a34a',
  adubo:    '#d97706',
  foliar:   '#0891b2',
  colheita: '#7c3aed',
  manejo:   '#6b7280',
  especial: '#dc2626',
};

const TIPO_LABEL = {
  plantio: 'Plantio', adubo: 'Adubação', foliar: 'Foliar',
  colheita: 'Colheita', manejo: 'Manejo', especial: 'Especial',
};

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

/** Resolve the status (done/date) for a specific step key from localStorage */
function resolveStepStatus(lote, stepKey) {
  try {
    const raw = localStorage.getItem(`cronograma_status_lote_${lote.id}`);
    const stored = raw ? JSON.parse(raw) : {};
    return stored[stepKey] || null;
  } catch { return null; }
}

/** Make a stable step ID matching CronogramaTimeline's logic */
function makeStepId(prefix, etapa) {
  const slug = etapa
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug}`;
}

/** Gera atividades de um lote para todos os dias do cronograma (viveiro + estático + customizados) */
function getAtividadesLote(lote, cultura) {
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
      const stepKey = makeStepId('viveiro', etapa.etapa);
      const stepStatus = resolveStepStatus(lote, stepKey);
      // If done with a different date, use the actual date
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
      const stepKey = makeStepId('default', etapa.etapa);
      const stepStatus = resolveStepStatus(lote, stepKey);
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

  // 3. Custom rows added by user via CronogramaTimeline (stored in localStorage)
  let customRows = [];
  try {
    const raw = localStorage.getItem(`cronograma_custom_lote_${lote.id}`);
    customRows = raw ? JSON.parse(raw) : [];
  } catch { customRows = []; }

  customRows.forEach((row, i) => {
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
    activities.push({
      id: `${lote.id}_custom_${i}`,
      loteId: lote.id,
      loteNome: lote.nome,
      culturaId: cultura.id,
      culturaNome: cultura.nome,
      culturaEmoji: cultura.emoji,
      culturaCor: cultura.cor,
      data: dataStr,
      dataPlanejada: dataStr,
      dia: row.dia,
      etapa: row.etapa || 'Atividade personalizada',
      produto: row.produto || '',
      dose: row.dose || '',
      tipo: row.tipo || 'manejo',
      isCustom: true,
      isViveiro: false,
      done: false,
    });
  });

  return activities;
}

function AtividadeCard({ ativ, isHoje }) {
  const cor = ativ.done ? '#16a34a' : (TIPO_COLOR[ativ.tipo] || '#6b7280');
  const dataDiferente = ativ.done && ativ.dataPlanejada && ativ.data !== ativ.dataPlanejada;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl mb-2"
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

export default function CalendarioPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodosLotes(50).then(data => { setLotes(data); setLoading(false); });
  }, []);

  const today = isoDate(new Date());

  // Build activity map: { 'YYYY-MM-DD': [ativ, ...] }
  const atividadesPorDia = {};
  lotes.forEach(lote => {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;
    getAtividadesLote(lote, cultura).forEach(a => {
      if (!atividadesPorDia[a.data]) atividadesPorDia[a.data] = [];
      atividadesPorDia[a.data].push(a);
    });
  });

  // Days of current week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const s = weekDays[0]; const e = weekDays[6];
    return `${s.getDate()} ${MESES_PT[s.getMonth()]} – ${e.getDate()} ${MESES_PT[e.getMonth()]} ${e.getFullYear()}`;
  })();

  const totalWeek = weekDays.reduce((n, d) => n + (atividadesPorDia[isoDate(d)]?.length || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-6 pb-5">
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Propriedade</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Calendário</h1>
        <p className="text-white/50 text-[11px] mt-1">{totalWeek} atividade{totalWeek !== 1 ? 's' : ''} esta semana</p>

        {/* Week nav */}
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setWeekStart(w => addDays(w, -7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <ChevronLeft size={16} color="white" />
          </button>
          <span className="flex-1 text-center text-[12px] font-semibold text-white/80">{weekLabel}</span>
          <button onClick={() => setWeekStart(w => addDays(w, 7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <ChevronRight size={16} color="white" />
          </button>
        </div>

        {/* Day strip */}
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
                      ? { background: 'hsl(160 84% 27%)', color: 'white' }
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
                  ativs.map(a => <AtividadeCard key={a.id} ativ={a} isHoje={isToday} />)
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
