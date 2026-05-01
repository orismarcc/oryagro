# Gestão da Propriedade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Calendário Unificado, Diário de Campo, Controle de Estoque e Fluxo de Caixa projetado ao OryAgro.

**Architecture:** Quatro features independentes compartilham a infra do Supabase (auth via `user_id`). Calendário e Fluxo de Caixa são read-only (calculados a partir dos lotes existentes). Diário de Campo e Estoque precisam de novas tabelas com RLS. Navegação inferior ganha dois novos itens (Calendário, Estoque); Simulador sai do nav principal (mantido acessível via CulturaPicker).

**Tech Stack:** React 18, Vite, Tailwind v4, Framer Motion v12, Supabase JS v2, Lucide-react, `src/data/precos.js` (custos), `useSupabaseSync.js` (padrão de queries com user_id).

---

## Mapa de arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `supabase/migrations/20260429_gestao.sql` | Tabelas diario_campo, estoque_insumos, estoque_movimentos + RLS |
| Criar | `src/hooks/useGestao.js` | Queries Supabase para diário e estoque (getUserId pattern) |
| Criar | `src/components/CalendarioPage.jsx` | Calendário unificado de atividades de todos os lotes |
| Criar | `src/components/EstoquePage.jsx` | Gestão de estoque de insumos |
| Modificar | `src/components/LotePage.jsx` | Adicionar aba "Diário" (TabDiario) |
| Modificar | `src/components/AnalysePage.jsx` | Adicionar seção "Fluxo de Caixa" ao final |
| Modificar | `src/App.jsx` | Nav: Início, Calendário, Estoque, Análise, Comparar (5 itens; Simulador via Início) |

---

## Task 1 — Supabase migration: tabelas de gestão

**Files:**
- Create: `supabase/migrations/20260429_gestao.sql`

- [ ] **1.1** Criar o arquivo de migration:

```sql
-- supabase/migrations/20260429_gestao.sql

-- ── Diário de campo ──────────────────────────────────────────────────────────
create table if not exists diario_campo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) not null,
  plantio_id  uuid references plantios(id) on delete set null,
  data        date not null default current_date,
  tipo        text not null default 'observacao',
  -- tipos: observacao | praga | colheita | clima | outro
  texto       text not null,
  created_at  timestamptz default now()
);

-- ── Estoque de insumos ───────────────────────────────────────────────────────
create table if not exists estoque_insumos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) not null,
  nome              text not null,
  unidade           text not null default 'kg',
  quantidade        numeric not null default 0,
  quantidade_minima numeric not null default 0,
  preco_unitario    numeric default 0,
  updated_at        timestamptz default now()
);

-- ── Movimentos de estoque ────────────────────────────────────────────────────
create table if not exists estoque_movimentos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) not null,
  insumo_id  uuid references estoque_insumos(id) on delete cascade not null,
  tipo       text not null, -- entrada | saida
  quantidade numeric not null,
  observacao text,
  data       date not null default current_date,
  created_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table diario_campo        enable row level security;
alter table estoque_insumos     enable row level security;
alter table estoque_movimentos  enable row level security;

create policy "user_own_diario"
  on diario_campo for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_own_estoque_insumos"
  on estoque_insumos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_own_estoque_movimentos"
  on estoque_movimentos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **1.2** Executar no Supabase via CLI:

```bash
cd /c/Users/Orismar/Documents/Agricultura/oryagro
SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> \
  npx supabase@latest db query --linked \
  -f supabase/migrations/20260429_gestao.sql
```

Esperado: `"rows": []` (sem erro).

- [ ] **1.3** Verificar tabelas:

```bash
# crie supabase/verify.sql temporariamente:
# select table_name from information_schema.tables
# where table_name in ('diario_campo','estoque_insumos','estoque_movimentos');
SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> \
  npx supabase@latest db query --linked -f supabase/verify.sql
```

Esperado: 3 linhas com os nomes das tabelas.

- [ ] **1.4** Commit:

```bash
git add supabase/migrations/20260429_gestao.sql
git commit -m "chore(supabase): tabelas diario_campo, estoque_insumos, estoque_movimentos + RLS"
```

---

## Task 2 — Hook `useGestao.js`

**Files:**
- Create: `src/hooks/useGestao.js`

Centraliza todas as queries Supabase das novas tabelas, seguindo o padrão `getUserId()` já usado em `useSupabaseSync.js`.

- [ ] **2.1** Criar `src/hooks/useGestao.js`:

```js
import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Diário de campo ──────────────────────────────────────────────────────────

export async function loadDiario(plantioId = null) {
  const userId = await getUserId();
  if (!userId) return [];
  let q = supabase
    .from('diario_campo')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (plantioId) q = q.eq('plantio_id', plantioId);
  const { data } = await q;
  return data || [];
}

export async function addDiarioEntry({ plantioId, data, tipo, texto }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data: row, error } = await supabase
    .from('diario_campo')
    .insert({ user_id: userId, plantio_id: plantioId || null, data, tipo, texto })
    .select()
    .single();
  if (error) { console.error('diario insert error', error); return null; }
  return row;
}

export async function deleteDiarioEntry(id) {
  const { error } = await supabase.from('diario_campo').delete().eq('id', id);
  return !error;
}

// ── Estoque ───────────────────────────────────────────────────────────────────

export async function loadEstoque() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('estoque_insumos')
    .select('*')
    .eq('user_id', userId)
    .order('nome');
  return data || [];
}

export async function upsertInsumo({ id, nome, unidade, quantidade, quantidade_minima, preco_unitario }) {
  const userId = await getUserId();
  if (!userId) return null;
  const payload = { user_id: userId, nome, unidade, quantidade, quantidade_minima, preco_unitario, updated_at: new Date().toISOString() };
  const { data, error } = id
    ? await supabase.from('estoque_insumos').update(payload).eq('id', id).select().single()
    : await supabase.from('estoque_insumos').insert(payload).select().single();
  if (error) { console.error('upsertInsumo error', error); return null; }
  return data;
}

export async function deleteInsumo(id) {
  const { error } = await supabase.from('estoque_insumos').delete().eq('id', id);
  return !error;
}

export async function addMovimento({ insumoId, tipo, quantidade, observacao, data }) {
  const userId = await getUserId();
  if (!userId) return null;
  // insert movimento
  const { error: mErr } = await supabase
    .from('estoque_movimentos')
    .insert({ user_id: userId, insumo_id: insumoId, tipo, quantidade, observacao: observacao || null, data });
  if (mErr) { console.error('addMovimento error', mErr); return null; }
  // update estoque_insumos.quantidade
  const delta = tipo === 'entrada' ? quantidade : -quantidade;
  const { data: updated, error: uErr } = await supabase.rpc('increment_estoque', { p_id: insumoId, p_delta: delta });
  if (uErr) {
    // fallback: fetch + update manual
    const { data: current } = await supabase.from('estoque_insumos').select('quantidade').eq('id', insumoId).single();
    if (current) {
      await supabase.from('estoque_insumos')
        .update({ quantidade: Math.max(0, current.quantidade + delta), updated_at: new Date().toISOString() })
        .eq('id', insumoId);
    }
  }
  return updated;
}

export async function loadMovimentos(insumoId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('estoque_movimentos')
    .select('*')
    .eq('user_id', userId)
    .eq('insumo_id', insumoId)
    .order('data', { ascending: false })
    .limit(30);
  return data || [];
}
```

> **Nota:** `increment_estoque` é um RPC Supabase opcional (mais eficiente). O fallback manual garante funcionamento sem ele.

- [ ] **2.2** Commit:

```bash
git add src/hooks/useGestao.js
git commit -m "feat(hooks): useGestao — queries diário e estoque com user_id scoping"
```

---

## Task 3 — CalendarioPage

**Files:**
- Create: `src/components/CalendarioPage.jsx`

Lê todos os lotes ativos via `loadTodosLotes()`, calcula as atividades do cronograma de cada um com base em `data_plantio + dia`, agrupa por data e exibe na semana atual com navegação ±1 semana.

- [ ] **3.1** Criar `src/components/CalendarioPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock } from 'lucide-react';
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

/** Gera atividades de um lote para os próximos/anteriores N dias */
function getAtividadesLote(lote, cultura) {
  if (!cultura?.cronograma) return [];
  const plantioDate = new Date(lote.data_plantio + 'T12:00:00');
  const usaMudas = typeof window !== 'undefined'
    ? localStorage.getItem(`lote_mudas_${lote.id}`) === '1'
    : false;
  const shift = usaMudas ? 15 : 0;
  return cultura.cronograma.map((etapa, i) => {
    const dataAtividade = addDays(plantioDate, etapa.dia + shift);
    return {
      id: `${lote.id}_${i}`,
      loteId: lote.id,
      loteNome: lote.nome,
      culturaId: cultura.id,
      culturaNome: cultura.nome,
      culturaEmoji: cultura.emoji,
      culturaCor: cultura.cor,
      data: isoDate(dataAtividade),
      dia: etapa.dia,
      etapa: etapa.etapa,
      produto: etapa.produto,
      dose: etapa.dose,
      tipo: etapa.tipo || 'manejo',
    };
  });
}

function AtividadeCard({ ativ, isHoje }) {
  const cor = TIPO_COLOR[ativ.tipo] || '#6b7280';
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl mb-2"
      style={{ background: isHoje ? `${cor}10` : 'white', border: `1px solid ${isHoje ? cor+'40' : 'hsl(214 20% 91%)'}` }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: `${ativ.culturaCor}15` }}>
        {ativ.culturaEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-bold text-foreground">{ativ.etapa}</span>
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
            style={{ background: `${cor}18`, color: cor }}>
            {TIPO_LABEL[ativ.tipo] || ativ.tipo}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {ativ.loteNome} · {ativ.culturaNome}
          {ativ.produto && ativ.produto !== '—' ? ` · ${ativ.produto}` : ''}
        </p>
        {ativ.dose && ativ.dose !== '—' && (
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
```

- [ ] **3.2** Commit:

```bash
git add src/components/CalendarioPage.jsx
git commit -m "feat(calendario): calendário unificado de atividades de todos os lotes"
```

---

## Task 4 — Diário de Campo (tab em LotePage)

**Files:**
- Modify: `src/components/LotePage.jsx` — adicionar `TabDiario` e nova entrada em `TABS`

- [ ] **4.1** No topo de `LotePage.jsx`, adicionar imports:

```js
import { BookOpen } from 'lucide-react';
import { loadDiario, addDiarioEntry, deleteDiarioEntry } from '../hooks/useGestao';
```

- [ ] **4.2** Adicionar 'diario' em `TABS` (linha ~542):

```js
const TABS = [
  { value: 'cronograma', label: 'Cronograma', Icon: CalendarDays },
  { value: 'insumos',    label: 'Insumos',    Icon: Package },
  { value: 'colheita',   label: 'Colheita',   Icon: TrendingUp },
  { value: 'diario',     label: 'Diário',     Icon: BookOpen },
];
```

- [ ] **4.3** Adicionar componente `TabDiario` antes do `export default function LotePage`:

```jsx
const TIPOS_DIARIO = [
  { key: 'observacao', label: 'Observação', emoji: '🔍' },
  { key: 'praga',      label: 'Praga',      emoji: '🐛' },
  { key: 'colheita',   label: 'Colheita',   emoji: '🌾' },
  { key: 'clima',      label: 'Clima',      emoji: '🌧️' },
  { key: 'outro',      label: 'Outro',      emoji: '📝' },
];

function TabDiario({ lote, cor }) {
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tipo, setTipo]         = useState('observacao');
  const [texto, setTexto]       = useState('');
  const [data, setData]         = useState(today());
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    loadDiario(lote.id).then(rows => { setEntries(rows); setLoading(false); });
  }, [lote.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setSaving(true);
    const row = await addDiarioEntry({ plantioId: lote.id, data, tipo, texto: texto.trim() });
    if (row) { setEntries(prev => [row, ...prev]); setTexto(''); setData(today()); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await deleteDiarioEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
      {/* Form */}
      <div className="card p-4 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Nova entrada</p>
        <form onSubmit={handleAdd} className="space-y-3">
          {/* Tipo selector */}
          <div className="flex gap-1.5 flex-wrap">
            {TIPOS_DIARIO.map(t => (
              <button key={t.key} type="button" onClick={() => setTipo(t.key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                style={tipo === t.key
                  ? { background: cor, color: '#fff' }
                  : { background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Data */}
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
            style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />

          {/* Texto */}
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Descreva o que observou, fez ou colheu…"
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }}
          />

          <button type="submit" disabled={saving || !texto.trim()}
            className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: cor }}>
            {saving ? 'Salvando…' : 'Registrar'}
          </button>
        </form>
      </div>

      {/* Entries */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Histórico</p>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">Nenhum registro ainda.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const t = TIPOS_DIARIO.find(x => x.key === entry.tipo) || TIPOS_DIARIO[4];
            const [ano, mes, dia] = entry.data.split('-');
            return (
              <motion.div key={entry.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="card p-3 flex gap-3 items-start">
                <span className="text-base leading-none mt-0.5">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cor }}>{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{dia}/{mes}/{ano}</span>
                  </div>
                  <p className="text-[12px] text-foreground leading-relaxed">{entry.texto}</p>
                </div>
                <button onClick={() => handleDelete(entry.id)}
                  className="flex-shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **4.4** No bloco `{tab === 'colheita' && ...}` dentro do `<AnimatePresence>`, adicionar após:

```jsx
{tab === 'diario' && (
  <TabDiario lote={lote} cor={cor} />
)}
```

- [ ] **4.5** Commit:

```bash
git add src/components/LotePage.jsx
git commit -m "feat(lote): aba Diário de Campo com registro e histórico por lote"
```

---

## Task 5 — EstoquePage

**Files:**
- Create: `src/components/EstoquePage.jsx`

- [ ] **5.1** Criar `src/components/EstoquePage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package2, Plus, TrendingUp, TrendingDown, X, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { loadEstoque, upsertInsumo, deleteInsumo, addMovimento, loadMovimentos } from '../hooks/useGestao';

const INSUMOS_PADRAO = [
  { nome: 'Calcário dolomítico', unidade: 'kg', quantidade_minima: 50 },
  { nome: 'Esterco bovino',      unidade: 'kg', quantidade_minima: 100 },
  { nome: 'NPK 10-10-10',        unidade: 'kg', quantidade_minima: 25 },
  { nome: 'Ureia 46%',           unidade: 'kg', quantidade_minima: 20 },
  { nome: 'Nitrato de Cálcio',   unidade: 'kg', quantidade_minima: 10 },
  { nome: 'Defensivo foliar',    unidade: 'L',  quantidade_minima: 2  },
  { nome: 'Sementes (geral)',    unidade: 'un', quantidade_minima: 100 },
];

function statusColor(qty, min) {
  if (qty <= 0)       return '#dc2626'; // vermelho — zerado
  if (qty <= min)     return '#d97706'; // laranja — abaixo do mínimo
  return '#059669';                     // verde — ok
}

function StatusDot({ qty, min }) {
  const c = statusColor(qty, min);
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />;
}

// ── Modal: movimentação ──────────────────────────────────────────────────────

function MovModal({ insumo, onClose, onMoved }) {
  const [tipo, setTipo]     = useState('entrada');
  const [qty, setQty]       = useState('');
  const [obs, setObs]       = useState('');
  const [data, setData]     = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    loadMovimentos(insumo.id).then(setHistorico);
  }, [insumo.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qty || parseFloat(qty) <= 0) return;
    setSaving(true);
    await addMovimento({ insumoId: insumo.id, tipo, quantidade: parseFloat(qty), observacao: obs, data });
    setSaving(false);
    onMoved();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="rounded-t-3xl overflow-y-auto"
        style={{ background: 'white', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted" /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b" style={{ borderColor: 'hsl(214 20% 91%)' }}>
          <div>
            <h3 className="font-bold text-[15px]">{insumo.nome}</h3>
            <p className="text-[11px] text-muted-foreground">
              Estoque atual: <strong>{insumo.quantidade} {insumo.unidade}</strong>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-muted"><X size={14} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              {[{ k:'entrada', l:'Entrada (compra)', Icon: TrendingUp },
                { k:'saida',   l:'Saída (uso)',      Icon: TrendingDown }].map(({ k, l, Icon }) => (
                <button key={k} type="button" onClick={() => setTipo(k)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                  style={tipo === k
                    ? { background: k === 'entrada' ? '#dcfce7' : '#fee2e2', color: k === 'entrada' ? '#16a34a' : '#dc2626', border: `1.5px solid ${k === 'entrada' ? '#86efac' : '#fca5a5'}` }
                    : { background: 'hsl(210 16% 95%)', color: 'hsl(215 16% 45%)' }}>
                  <Icon size={13} /> {l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade ({insumo.unidade})</label>
                <input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)} required
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
                  style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observação (opcional)</label>
              <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Compra na agropecuária"
                className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
            </div>

            <button type="submit" disabled={saving || !qty}
              className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>
              {saving ? 'Salvando…' : tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
            </button>
          </form>

          {historico.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Últimos movimentos</p>
              <div className="space-y-1.5">
                {historico.map(m => {
                  const [ano, mes, dia] = m.data.split('-');
                  return (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: m.tipo === 'entrada' ? '#f0fdf4' : '#fef2f2' }}>
                      {m.tipo === 'entrada'
                        ? <TrendingUp size={11} style={{ color: '#16a34a' }} />
                        : <TrendingDown size={11} style={{ color: '#dc2626' }} />}
                      <span className="text-[12px] font-bold flex-1" style={{ color: m.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>
                        {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade} {insumo.unidade}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{dia}/{mes}/{ano}</span>
                      {m.observacao && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{m.observacao}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Modal: adicionar insumo ───────────────────────────────────────────────────

function AddInsumoModal({ onClose, onAdded }) {
  const [nome, setNome]       = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [min, setMin]         = useState('');
  const [preco, setPreco]     = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const row = await upsertInsumo({
      nome, unidade,
      quantidade: 0,
      quantidade_minima: parseFloat(min) || 0,
      preco_unitario: parseFloat(preco) || 0,
    });
    setSaving(false);
    if (row) { onAdded(row); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="rounded-t-3xl"
        style={{ background: 'white' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted" /></div>
        <div className="px-5 pt-2 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(214 20% 91%)' }}>
          <h3 className="font-bold text-[15px]">Novo insumo</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-muted"><X size={14} /></button>
        </div>

        {/* Sugestões rápidas */}
        <div className="px-5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Sugestões rápidas</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {INSUMOS_PADRAO.map(s => (
              <button key={s.nome} type="button"
                onClick={() => { setNome(s.nome); setUnidade(s.unidade); setMin(String(s.quantidade_minima)); }}
                className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 35%)' }}>
                {s.nome}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-8 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome do insumo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Ureia 46%"
              className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidade</label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }}>
                {['kg','L','g','mL','saco','un'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Qtd mínima</label>
              <input type="number" min="0" step="0.1" value={min} onChange={e => setMin(e.target.value)} placeholder="0"
                className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preço unitário (R$) — opcional</label>
            <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00"
              className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }} />
          </div>
          <button type="submit" disabled={saving || !nome}
            className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: 'hsl(160 84% 27%)' }}>
            {saving ? 'Salvando…' : 'Adicionar insumo'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const [insumos, setInsumos]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [movModal, setMovModal]     = useState(null); // insumo object
  const [addModal, setAddModal]     = useState(false);

  const reload = () => loadEstoque().then(setInsumos);

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  const alertas = insumos.filter(i => i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0);

  const handleDelete = async (id) => {
    await deleteInsumo(id);
    setInsumos(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-6 pb-5">
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Propriedade</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Estoque</h1>
        <p className="text-white/50 text-[11px] mt-1">{insumos.length} insumo{insumos.length !== 1 ? 's' : ''} cadastrado{insumos.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setAddModal(true)}
          className="mt-3 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
          <Plus size={13} /> Adicionar insumo
        </button>
      </div>

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto space-y-4">
        {/* Alertas */}
        {alertas.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl p-4"
            style={{ background: 'hsl(38 90% 97%)', border: '1px solid hsl(38 90% 85%)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: '#d97706' }} />
              <p className="text-[12px] font-bold" style={{ color: '#d97706' }}>
                {alertas.length} insumo{alertas.length !== 1 ? 's' : ''} abaixo do mínimo
              </p>
            </div>
            {alertas.map(i => (
              <p key={i.id} className="text-[11px] text-muted-foreground">
                · {i.nome}: {i.quantidade} {i.unidade} (mín. {i.quantidade_minima})
              </p>
            ))}
          </motion.div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : insumos.length === 0 ? (
          <div className="text-center py-16">
            <Package2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-[13px] text-muted-foreground">Nenhum insumo cadastrado.</p>
            <p className="text-[11px] text-muted-foreground mt-1">Adicione os insumos que você usa na propriedade.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {insumos.map(insumo => {
              const cor = statusColor(insumo.quantidade, insumo.quantidade_minima);
              const pct = insumo.quantidade_minima > 0
                ? Math.min(100, (insumo.quantidade / (insumo.quantidade_minima * 2)) * 100)
                : 50;
              return (
                <motion.div key={insumo.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-4">
                  <div className="flex items-center gap-3">
                    <StatusDot qty={insumo.quantidade} min={insumo.quantidade_minima} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground leading-none">{insumo.nome}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {insumo.quantidade} {insumo.unidade}
                        {insumo.quantidade_minima > 0 && ` · mín. ${insumo.quantidade_minima} ${insumo.unidade}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setMovModal(insumo)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
                        style={{ background: `${cor}15`, color: cor }}>
                        Movimentar
                      </button>
                      <button onClick={() => handleDelete(insumo.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 92%)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: cor }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {movModal && (
          <MovModal
            insumo={movModal}
            onClose={() => setMovModal(null)}
            onMoved={reload}
          />
        )}
        {addModal && (
          <AddInsumoModal
            onClose={() => setAddModal(false)}
            onAdded={row => { setInsumos(prev => [...prev, row]); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **5.2** Commit:

```bash
git add src/components/EstoquePage.jsx
git commit -m "feat(estoque): controle de estoque de insumos com entradas/saídas e alertas"
```

---

## Task 6 — Fluxo de Caixa (seção em AnalysePage)

**Files:**
- Modify: `src/components/AnalysePage.jsx` — adicionar seção de fluxo de caixa projetado no final

A lógica: para cada lote ativo, estimar mês de colheita = `data_plantio + cicloDias`. Calcular receita projetada = `producaoKgPorHa × precoVenda × sobrevivência` (ou equivalente para canteiros). Agrupar por mês nos próximos 6 meses.

- [ ] **6.1** No início de `AnalysePage.jsx`, adicionar os helpers:

```js
import { PRECOS_INSUMOS } from '../data/precos';

function projetarFluxo(lotes) {
  const hoje = new Date();
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receita: 0,
      custo: 0,
    };
  });

  lotes.forEach(lote => {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;
    const cicloDias = parseCicloDias(cultura.ciclo);
    const colheitaDate = new Date(lote.data_plantio + 'T12:00:00');
    colheitaDate.setDate(colheitaDate.getDate() + cicloDias);

    const mesKey = `${colheitaDate.getFullYear()}-${String(colheitaDate.getMonth()+1).padStart(2,'0')}`;
    const slot = meses.find(m => m.key === mesKey);
    if (!slot) return;

    const v = cultura.venda;
    const sob = (v.sobrevivencia || 90) / 100;
    let receita = 0;

    if (cultura.tipo === 'campo' && v.producaoKgPorHa) {
      const ha = parseFloat(lote.area_ha) || 1;
      receita = v.producaoKgPorHa * ha * sob * v.precoUnitario;
    } else if (v.producaoBase != null) {
      const nC = Math.max(1, Math.floor(10000 / (cultura.canteiro.comprimento * (cultura.canteiro.largura + 0.5))));
      receita = v.producaoBase * sob * v.precoUnitario * nC;
    } else {
      const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
      const porLinha = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
      receita = linhas * porLinha * sob * v.precoUnitario;
    }

    slot.receita += receita;
  });

  return meses;
}
```

- [ ] **6.2** Adicionar componente `FluxoCaixaSection` no arquivo:

```jsx
function FluxoCaixaSection({ lotes }) {
  const meses = projetarFluxo(lotes);
  const maxReceita = Math.max(...meses.map(m => m.receita), 1);
  const totalProjetado = meses.reduce((s, m) => s + m.receita, 0);

  return (
    <div className="px-4 mb-8">
      <SectionLabel>Fluxo de caixa projetado — 6 meses</SectionLabel>
      <div className="card p-4">
        <div className="flex items-end justify-between mb-3">
          <p className="text-[12px] text-muted-foreground">Receita estimada com base nos lotes ativos</p>
          <p className="text-[12px] font-bold text-foreground">{formatCurrency(totalProjetado)}</p>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-24 mb-3">
          {meses.map(mes => {
            const pct = maxReceita > 0 ? (mes.receita / maxReceita) * 100 : 0;
            const isCurrentMonth = mes.key === `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
            return (
              <div key={mes.key} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-[9px] font-bold text-muted-foreground">
                  {mes.receita > 0 ? `R$${Math.round(mes.receita/1000)}k` : '—'}
                </p>
                <div className="w-full rounded-t-lg transition-all duration-700 flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg"
                    style={{
                      height: `${Math.max(pct, mes.receita > 0 ? 8 : 2)}%`,
                      background: isCurrentMonth ? 'hsl(160 84% 27%)' : 'hsl(160 60% 75%)',
                      minHeight: mes.receita > 0 ? '8px' : '2px',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Labels */}
        <div className="flex gap-2">
          {meses.map(mes => (
            <div key={mes.key} className="flex-1 text-center">
              <p className="text-[9px] text-muted-foreground font-semibold">{mes.label}</p>
            </div>
          ))}
        </div>

        {/* Breakdown list */}
        {meses.some(m => m.receita > 0) && (
          <div className="mt-4 space-y-1.5 border-t pt-3" style={{ borderColor: 'hsl(214 20% 91%)' }}>
            {meses.filter(m => m.receita > 0).map(mes => (
              <div key={mes.key} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{mes.label}</span>
                <span className="text-[12px] font-bold text-foreground">{formatCurrency(mes.receita)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[9px] text-muted-foreground mt-3">
          * Estimativa baseada em médias de produção. Valores reais dependem de clima, perdas e preços de mercado.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **6.3** No `return` de `AnalysePage`, adicionar `<FluxoCaixaSection lotes={lotes} />` após a lista de lotes (antes do `</div>` final).

- [ ] **6.4** Commit:

```bash
git add src/components/AnalysePage.jsx
git commit -m "feat(analise): seção de fluxo de caixa projetado por 6 meses"
```

---

## Task 7 — Navegação (App.jsx)

Trocar o bottom nav para 5 itens: **Início, Calendário, Estoque, Análise, Comparar**. Simulador continua acessível via Início → cultura → Simulador (já funciona hoje).

**Files:**
- Modify: `src/App.jsx`

- [ ] **7.1** Adicionar imports no topo de `App.jsx`:

```js
import CalendarioPage from './components/CalendarioPage';
import EstoquePage    from './components/EstoquePage';
import { Home, CalendarDays, Package2, BarChart2, Activity } from 'lucide-react';
```

- [ ] **7.2** Substituir `BOTTOM_NAV`:

```js
const BOTTOM_NAV = [
  { value: 'dashboard',  label: 'Início',     Icon: Home },
  { value: 'calendario', label: 'Calendário', Icon: CalendarDays },
  { value: 'estoque',    label: 'Estoque',    Icon: Package2 },
  { value: 'analise',    label: 'Análise',    Icon: Activity },
  { value: 'comparacao', label: 'Comparar',   Icon: BarChart2 },
];
```

- [ ] **7.3** Adicionar os novos cases no bloco de renderização (após `{mainView === 'comparacao' && <ComparacaoCulturas />}`):

```jsx
{mainView === 'calendario' && <CalendarioPage />}
{mainView === 'estoque'    && <EstoquePage />}
```

- [ ] **7.4** Ajustar a flag `dashboardActive` para incluir novos views que não são "raiz":

```js
const dashboardActive = value === 'dashboard' &&
  (mainView === 'dashboard' || mainView === 'cultura' ||
   mainView === 'cultura-picker' || mainView === 'lote');
```

(Sem alteração — já está correta. Calendário e Estoque são views raiz com próprio item no nav.)

- [ ] **7.5** Remover Simulador do `BOTTOM_NAV` já foi feito acima. Verificar que `SimuladorPage` ainda está importado e renderizado com `{mainView === 'simulador' && <SimuladorPage />}` — mantê-lo para acesso via URL/state direto.

- [ ] **7.6** Commit:

```bash
git add src/App.jsx
git commit -m "feat(nav): adicionar Calendário e Estoque na navegação inferior (5 itens)"
```

---

## Task 8 — Deploy final

- [ ] **8.1** Build de verificação:

```bash
cd /c/Users/Orismar/Documents/Agricultura/oryagro
npm run build 2>&1 | grep -E "error|✓ built"
```

Esperado: `✓ built in X.XXs` sem erros.

- [ ] **8.2** Deploy:

```bash
SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> \
  npx vercel --prod 2>&1 | tail -4
```

---

## Checklist de cobertura

- [x] Calendário unificado lê todos os lotes e cronogramas
- [x] Navegação por semana (±7 dias) com indicador do dia atual
- [x] Diário de campo como tab em LotePage — 5 tipos, data, texto, histórico, delete
- [x] Estoque com lista, status visual (🔴/🟡/🟢), alertas, entrada/saída, histórico, delete
- [x] Fluxo de caixa projetado 6 meses com bar chart SVG inline
- [x] Todas as queries Supabase filtradas por user_id (privacidade por usuário)
- [x] RLS em todas as novas tabelas
- [x] 5 itens no nav inferior: Início, Calendário, Estoque, Análise, Comparar
