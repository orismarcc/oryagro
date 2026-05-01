# Propriedades + Estoque Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Property layer above lotes, make stock per-property, integrate stock deduction with Cronograma, and fix the mamão duplicate-steps bug.

**Architecture:** Four SQL migrations add the `propriedades` table and FK columns; new `PropriedadesPage` and `PropriedadePage` replace the flat Dashboard lote list; `EstoquePage` becomes property-scoped via a `propriedadeId` prop; `CronogramaTimeline` gains optional stock-deduction when marking adubo/foliar steps as done.

**Tech Stack:** React 18 + Vite, Tailwind v4, Framer Motion v12, Supabase (PostgreSQL + Auth + RLS), lucide-react.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/20260430_propriedades.sql` | Create |
| `supabase/migrations/20260430_plantios_propriedade.sql` | Create |
| `supabase/migrations/20260430_estoque_propriedade.sql` | Create |
| `supabase/migrations/20260430_movimentos_plantio.sql` | Create |
| `src/data/culturas.js` | Modify: remove 2 steps from mamão cronograma |
| `src/components/CronogramaTimeline.jsx` | Modify: defensive filter + stock deduction |
| `src/hooks/useSupabaseSync.js` | Modify: add propriedades CRUD |
| `src/hooks/useGestao.js` | Modify: propriedadeId param in estoque functions |
| `src/components/PropriedadesPage.jsx` | Create |
| `src/components/PropriedadePage.jsx` | Create |
| `src/components/MigrationWizard.jsx` | Create |
| `src/components/EstoquePage.jsx` | Modify: propriedadeId prop, button layout fix |
| `src/components/Dashboard.jsx` | Modify: property cards instead of flat lote list |
| `src/components/LotesPage.jsx` | Modify: pass propriedade_id in registrarPlantio payload |
| `src/components/CulturaPage.jsx` | Modify: accept + pass propriedadeId |
| `src/App.jsx` | Modify: views, navbar, propriedadeId state |

---

## Task 1: Fix mamão cronograma duplicate steps

**Files:**
- Modify: `src/data/culturas.js`
- Modify: `src/components/CronogramaTimeline.jsx`

The `mamao_tainung.cronograma` array currently has two steps that duplicate what the `etapasViveiro` of `muda_saquinho` and `muda_bolo` already show:
- `{ dia: 0, etapa: 'Viveiro — produção de mudas', tipo: 'plantio' }` — duplicates start of viveiro
- `{ dia: 45, etapa: 'Transplante ao campo', tipo: 'plantio' }` — duplicates transplante especial

After removing them, `maxBaseDia` drops from 300 → 300 (the `dia: 300` fertilization step remains). The first real post-viveiro step will be dia 60 (Adubação de arranque), which scales to D90 for `muda_saquinho` (diasViveiro=45, diasPrimeiraProducao=270).

- [ ] **Step 1.1 — Remove the two duplicate steps from mamão cronograma**

In `src/data/culturas.js`, find the `mamao_tainung` entry (`id: 'mamao_tainung'`). Its `cronograma` array currently begins:
```js
cronograma: [
  { dia: 0,   etapa: 'Viveiro — produção de mudas',  produto: 'Sementes Tainung 01', ... tipo: 'plantio' },
  { dia: 45,  etapa: 'Transplante ao campo',          produto: 'Mudas (4–6 folhas)',  ... tipo: 'plantio' },
  { dia: 60,  etapa: 'Adubação de arranque', ...
```

Delete exactly those first two entries so the cronograma starts at `dia: 60`:
```js
cronograma: [
  { dia: 60,  etapa: 'Adubação de arranque',              produto: 'NPK 10-10-10',                dose: '100 kg/ha',   forma: 'Em anel ao redor de cada muda, a 20–30 cm do caule. Irrigar em seguida', tipo: 'adubo' },
  // ... rest unchanged
```

- [ ] **Step 1.2 — Add defensive filter in CronogramaTimeline.allEvents**

In `src/components/CronogramaTimeline.jsx`, the `allEvents` array is built starting around line 267. The current code is:
```js
const allEvents = [
  ...etapasViveiro,
  ...cultura.cronograma.map(e => {
    // ...
    return { ...e, ...override, dia: scaleBaseDia(e.dia), _id: makeStableId('default', e.etapa), _custom: false };
  }),
  ...customRows.map((e, i) => ({ ...e, _id: `custom_${i}`, _custom: true })),
].sort((a, b) => a.dia - b.dia);
```

Add a filter so that when the viveiro has a transplant-type step (`tipo === 'especial'`), base cronograma steps with `dia === 0 && tipo === 'plantio'` are skipped (prevents future regressions if the raw data is ever restored):

```js
// True when viveiro steps already include a transplante (tipo especial)
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
].sort((a, b) => a.dia - b.dia);
```

- [ ] **Step 1.3 — Check acerola and banana for similar collisions**

In `src/data/culturas.js`, search for cultures where `cronograma` contains `dia: 0` with `tipo: 'plantio'` AND the culture also has `metodosPropagacao` with `etapasViveiro`. If found, remove the duplicate day-0 plantio step from the cronograma. (The defensive filter from Step 1.2 would catch it at runtime, but it's cleaner to remove it from data.)

- [ ] **Step 1.4 — Verify in dev server**

Run: `npm run dev`
Navigate to a mamão lote with method `muda_saquinho` → Cronograma tab.
Expected: No "Viveiro — produção de mudas" or duplicate "Transplante ao campo" in the base steps; viveiro steps show from `etapasViveiro` only.

- [ ] **Step 1.5 — Commit**
```bash
git add src/data/culturas.js src/components/CronogramaTimeline.jsx
git commit -m "fix: remove duplicate viveiro/transplante steps from mamão cronograma"
```

---

## Task 2: Supabase migrations

**Files:**
- Create: `supabase/migrations/20260430_propriedades.sql`
- Create: `supabase/migrations/20260430_plantios_propriedade.sql`
- Create: `supabase/migrations/20260430_estoque_propriedade.sql`
- Create: `supabase/migrations/20260430_movimentos_plantio.sql`

- [ ] **Step 2.1 — Create propriedades table migration**

Create `supabase/migrations/20260430_propriedades.sql`:
```sql
CREATE TABLE propriedades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE propriedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON propriedades
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2.2 — Add propriedade_id to plantios**

Create `supabase/migrations/20260430_plantios_propriedade.sql`:
```sql
ALTER TABLE plantios
  ADD COLUMN IF NOT EXISTS propriedade_id uuid
    REFERENCES propriedades(id) ON DELETE SET NULL;
```

- [ ] **Step 2.3 — Add propriedade_id to estoque_insumos**

Create `supabase/migrations/20260430_estoque_propriedade.sql`:
```sql
ALTER TABLE estoque_insumos
  ADD COLUMN IF NOT EXISTS propriedade_id uuid
    REFERENCES propriedades(id) ON DELETE CASCADE;
```

- [ ] **Step 2.4 — Add plantio_id to estoque_movimentos**

Create `supabase/migrations/20260430_movimentos_plantio.sql`:
```sql
ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS plantio_id uuid
    REFERENCES plantios(id) ON DELETE SET NULL;
```

- [ ] **Step 2.5 — Apply migrations via Supabase dashboard or CLI**

Run against your Supabase project (SQL Editor or `supabase db push`). Verify:
- Table `propriedades` exists with RLS enabled
- `plantios` has column `propriedade_id` (nullable)
- `estoque_insumos` has column `propriedade_id` (nullable)
- `estoque_movimentos` has column `plantio_id` (nullable)

- [ ] **Step 2.6 — Commit**
```bash
git add supabase/migrations/
git commit -m "chore: add SQL migrations for propriedades, FK columns on plantios/estoque"
```

---

## Task 3: useSupabaseSync.js — propriedades CRUD

**Files:**
- Modify: `src/hooks/useSupabaseSync.js`

- [ ] **Step 3.1 — Add propriedades CRUD functions**

Append to the end of `src/hooks/useSupabaseSync.js`:
```js
// ── Propriedades ─────────────────────────────────────────────────────────────

/**
 * Load all properties for the current user, alphabetically sorted.
 */
export async function loadPropriedades() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('propriedades')
    .select('*')
    .eq('user_id', userId)
    .order('nome');
  return data || [];
}

/**
 * Create a new property. Returns the created row or null.
 */
export async function createPropriedade({ nome, descricao }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('propriedades')
    .insert({ user_id: userId, nome, descricao: descricao || null })
    .select()
    .single();
  if (error) { console.error('createPropriedade error', error); return null; }
  return data;
}

/**
 * Update an existing property. Returns the updated row or null.
 */
export async function updatePropriedade(id, { nome, descricao }) {
  const { data, error } = await supabase
    .from('propriedades')
    .update({ nome, descricao: descricao || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updatePropriedade error', error); return null; }
  return data;
}

/**
 * Delete a property by id. Returns true on success.
 * Note: plantios with this propriedade_id will have it set to NULL (ON DELETE SET NULL).
 * Estoque insumos will be cascade-deleted (ON DELETE CASCADE).
 * Check for linked lotes before calling this.
 */
export async function deletePropriedade(id) {
  const { error } = await supabase.from('propriedades').delete().eq('id', id);
  return !error;
}

/**
 * Load all plantios (lotes) belonging to a specific property.
 */
export async function loadLotesByPropriedade(propriedadeId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .eq('propriedade_id', propriedadeId)
    .order('data_plantio', { ascending: false });
  return data || [];
}

/**
 * Count lotes per property for the current user.
 * Returns an object: { [propriedadeId]: count }
 */
export async function countLotesByPropriedade() {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase
    .from('plantios')
    .select('propriedade_id')
    .eq('user_id', userId)
    .not('propriedade_id', 'is', null);
  if (!data) return {};
  return data.reduce((acc, row) => {
    acc[row.propriedade_id] = (acc[row.propriedade_id] || 0) + 1;
    return acc;
  }, {});
}
```

- [ ] **Step 3.2 — Verify no syntax errors**

Run: `npm run build`
Expected: Build completes with no errors in `useSupabaseSync.js`.

- [ ] **Step 3.3 — Commit**
```bash
git add src/hooks/useSupabaseSync.js
git commit -m "feat: add propriedades CRUD to useSupabaseSync"
```

---

## Task 4: useGestao.js — property-scoped estoque

**Files:**
- Modify: `src/hooks/useGestao.js`

- [ ] **Step 4.1 — Add propriedadeId to loadEstoque**

Replace the current `loadEstoque` function (lines 43–52 in `src/hooks/useGestao.js`):
```js
export async function loadEstoque(propriedadeId = null) {
  const userId = await getUserId();
  if (!userId) return [];
  let q = supabase
    .from('estoque_insumos')
    .select('*')
    .eq('user_id', userId)
    .order('nome');
  if (propriedadeId) q = q.eq('propriedade_id', propriedadeId);
  const { data } = await q;
  return data || [];
}
```

- [ ] **Step 4.2 — Add propriedadeId to upsertInsumo**

Replace the current `upsertInsumo` function (lines 54–71):
```js
export async function upsertInsumo({ id, nome, unidade, quantidade, quantidade_minima, preco_unitario, propriedadeId }) {
  const userId = await getUserId();
  if (!userId) return null;
  const payload = {
    user_id: userId,
    nome,
    unidade,
    quantidade,
    quantidade_minima,
    preco_unitario,
    ...(propriedadeId ? { propriedade_id: propriedadeId } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = id
    ? await supabase.from('estoque_insumos').update(payload).eq('id', id).select().single()
    : await supabase.from('estoque_insumos').insert(payload).select().single();
  if (error) { console.error('upsertInsumo error', error); return null; }
  return data;
}
```

- [ ] **Step 4.3 — Add plantioId to addMovimento**

Replace the current `addMovimento` function (lines 78–112):
```js
export async function addMovimento({ insumoId, tipo, quantidade, observacao, data, plantioId }) {
  const userId = await getUserId();
  if (!userId) return null;

  // 1. Inserir movimento
  const { error: mErr } = await supabase
    .from('estoque_movimentos')
    .insert({
      user_id: userId,
      insumo_id: insumoId,
      tipo,
      quantidade,
      observacao: observacao || null,
      data,
      plantio_id: plantioId || null,
    });
  if (mErr) { console.error('addMovimento error', mErr); return null; }

  // 2. Atualizar quantidade no estoque (fetch + update)
  const delta = tipo === 'entrada' ? quantidade : -quantidade;
  const { data: current } = await supabase
    .from('estoque_insumos')
    .select('quantidade')
    .eq('id', insumoId)
    .single();
  if (current) {
    await supabase
      .from('estoque_insumos')
      .update({
        quantidade: Math.max(0, current.quantidade + delta),
        updated_at: new Date().toISOString(),
      })
      .eq('id', insumoId);
  }
  return true;
}
```

- [ ] **Step 4.4 — Also update loadMovimentos to include plantio info**

Replace `loadMovimentos` (lines 114–126) to join plantio name for richer history display:
```js
export async function loadMovimentos(insumoId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('estoque_movimentos')
    .select('*, plantio:plantios(nome)')
    .eq('user_id', userId)
    .eq('insumo_id', insumoId)
    .order('data', { ascending: false })
    .limit(30);
  return data || [];
}
```

- [ ] **Step 4.5 — Commit**
```bash
git add src/hooks/useGestao.js
git commit -m "feat: add propriedadeId/plantioId params to estoque hooks"
```

---

## Task 5: EstoquePage.jsx — property-scoped + button fix

**Files:**
- Modify: `src/components/EstoquePage.jsx`

- [ ] **Step 5.1 — Accept propriedadeId prop and wire queries**

Replace the function signature and the `reload`/`useEffect` at the top of `EstoquePage`:
```js
// OLD:
export default function EstoquePage() {
  const [insumos, setInsumos]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [movModal, setMovModal] = useState(null);
  const [addModal, setAddModal] = useState(false);

  const reload = () => loadEstoque().then(setInsumos);
  useEffect(() => { reload().then(() => setLoading(false)); }, []);

// NEW:
export default function EstoquePage({ propriedadeId = null }) {
  const [insumos, setInsumos]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [movModal, setMovModal] = useState(null);
  const [addModal, setAddModal] = useState(false);

  const reload = () => loadEstoque(propriedadeId).then(setInsumos);
  useEffect(() => { reload().then(() => setLoading(false)); }, [propriedadeId]);
```

- [ ] **Step 5.2 — Pass propriedadeId to AddInsumoModal and upsertInsumo**

The `AddInsumoModal` component is called from `EstoquePage`. Pass `propriedadeId` down and include it in the `upsertInsumo` call.

Change the `AddInsumoModal` function signature:
```js
function AddInsumoModal({ onClose, onAdded, propriedadeId }) {
```

Inside `handleSubmit`, update the `upsertInsumo` call:
```js
const row = await upsertInsumo({
  nome, unidade,
  quantidade: 0,
  quantidade_minima: parseFloat(min) || 0,
  preco_unitario: parseFloat(preco) || 0,
  propriedadeId,
});
```

In `EstoquePage`, update where `AddInsumoModal` is rendered (near line 363):
```js
{addModal && (
  <AddInsumoModal
    onClose={() => setAddModal(false)}
    onAdded={row => { setInsumos(prev => [...prev, row]); }}
    propriedadeId={propriedadeId}
  />
)}
```

- [ ] **Step 5.3 — Move "Adicionar insumo" button out of hero / fix overlap**

Currently the button is inside the `.gradient-hero` div. Move it to a sticky action bar below the hero so it never overlaps the navbar. Replace the current hero block (lines 269–279):

```jsx
{/* Hero */}
<div className="gradient-hero px-5 pt-6 pb-5">
  <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Estoque</p>
  <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Insumos</h1>
  <p className="text-white/50 text-[11px] mt-1">{insumos.length} insumo{insumos.length !== 1 ? 's' : ''} cadastrado{insumos.length !== 1 ? 's' : ''}</p>
</div>

{/* Action bar (below hero, not overlapping navbar) */}
<div className="px-4 pt-4 pb-2 max-w-2xl mx-auto flex items-center justify-between">
  <p className="section-label">Insumos cadastrados</p>
  <button
    onClick={() => setAddModal(true)}
    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white"
    style={{ background: 'hsl(160 84% 27%)' }}
  >
    <Plus size={13} /> Adicionar insumo
  </button>
</div>
```

Remove the old `<button onClick={() => setAddModal(true)} ...>` from inside the hero.

- [ ] **Step 5.4 — Show lote name in movement history**

In `MovModal`, update the history list to show the lote name when the movement has a `plantio`:
```js
{historico.map(m => {
  const [ano, mes, dia] = m.data.split('-');
  const loteLabel = m.plantio?.nome ? `· Lote: ${m.plantio.nome}` : '';
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
      {(m.observacao || loteLabel) && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
          {m.observacao || loteLabel}
        </span>
      )}
    </div>
  );
})}
```

- [ ] **Step 5.5 — Verify in dev server**

Run `npm run dev`, navigate to EstoquePage (still accessible via old nav for now).
Expected: no button overlap, list is empty (no insumos with propriedade_id yet — expected).

- [ ] **Step 5.6 — Commit**
```bash
git add src/components/EstoquePage.jsx
git commit -m "feat: EstoquePage accepts propriedadeId prop, fixes button overlap"
```

---

## Task 6: PropriedadesPage.jsx — manage properties

**Files:**
- Create: `src/components/PropriedadesPage.jsx`

- [ ] **Step 6.1 — Create PropriedadesPage**

Create `src/components/PropriedadesPage.jsx`:
```jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Pencil, Trash2, X, Building2, Layers, ChevronRight } from 'lucide-react';
import {
  loadPropriedades, createPropriedade, updatePropriedade, deletePropriedade, countLotesByPropriedade,
} from '../hooks/useSupabaseSync';

function PropriedadeForm({ initial, onSave, onCancel, saving }) {
  const [nome, setNome]     = useState(initial?.nome || '');
  const [desc, setDesc]     = useState(initial?.descricao || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), descricao: desc.trim() || null });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <p className="text-[13px] font-bold text-foreground">{initial ? 'Editar propriedade' : 'Nova propriedade'}</p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome *</label>
        <input
          type="text"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Sítio Portuga"
          required
          className="w-full mt-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</label>
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Ex: 5 ha, Mato Grosso"
          className="w-full mt-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border"
          style={{ borderColor: 'hsl(214 20% 88%)', color: 'hsl(215 16% 45%)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving || !nome.trim()}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: 'hsl(160 84% 27%)' }}>
          {saving ? 'Salvando…' : initial ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}

export default function PropriedadesPage({ onBack, onSelectPropriedade }) {
  const [propriedades, setPropriedades] = useState([]);
  const [loteCounts, setLoteCounts]     = useState({});
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [saving, setSaving]             = useState(false);

  const reload = async () => {
    const [props, counts] = await Promise.all([loadPropriedades(), countLotesByPropriedade()]);
    setPropriedades(props);
    setLoteCounts(counts);
  };

  useEffect(() => {
    reload().then(() => setLoading(false));
  }, []);

  const handleCreate = async (payload) => {
    setSaving(true);
    const row = await createPropriedade(payload);
    if (row) {
      setPropriedades(prev => [...prev, row]);
      setShowForm(false);
    }
    setSaving(false);
  };

  const handleUpdate = async (id, payload) => {
    setSaving(true);
    const row = await updatePropriedade(id, payload);
    if (row) {
      setPropriedades(prev => prev.map(p => p.id === id ? row : p));
      setEditingId(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const count = loteCounts[id] || 0;
    if (count > 0) {
      alert(`Esta propriedade tem ${count} lote(s) vinculado(s). Mova ou exclua os lotes antes de remover a propriedade.`);
      return;
    }
    if (!window.confirm('Excluir esta propriedade? O estoque vinculado também será excluído.')) return;
    setDeletingId(id);
    const ok = await deletePropriedade(id);
    if (ok) setPropriedades(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Início
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
            <Building2 size={18} color="white" />
          </div>
          <div>
            <h1 className="font-display text-white text-xl font-extrabold leading-tight">Propriedades</h1>
            <p className="text-white/55 text-[11px] mt-0.5">{propriedades.length} propriedade{propriedades.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            {propriedades.length === 0 && !showForm && (
              <div className="card p-8 flex flex-col items-center gap-3 text-center">
                <Building2 size={32} className="opacity-30" />
                <p className="text-[14px] font-bold text-foreground">Nenhuma propriedade</p>
                <p className="text-[12px] text-muted-foreground">Crie sua primeira propriedade para organizar seus lotes e estoque.</p>
              </div>
            )}

            <AnimatePresence>
              {propriedades.map((p, i) => {
                const count = loteCounts[p.id] || 0;
                if (editingId === p.id) {
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <PropriedadeForm
                        initial={p}
                        onSave={payload => handleUpdate(p.id, payload)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                  >
                    <button
                      onClick={() => onSelectPropriedade(p)}
                      className="card-interactive w-full text-left p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'hsl(160 84% 27% / 0.1)' }}>
                        <Building2 size={18} style={{ color: 'hsl(160 84% 27%)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground leading-tight truncate">{p.nome}</p>
                        {p.descricao && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.descricao}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Layers size={10} style={{ color: 'hsl(160 84% 27%)' }} />
                          <span className="text-[11px] text-muted-foreground">{count} lote{count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingId(p.id); setShowForm(false); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                          disabled={deletingId === p.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="opacity-30" />
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* New property form */}
            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                  <PropriedadeForm
                    onSave={handleCreate}
                    onCancel={() => setShowForm(false)}
                    saving={saving}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {!showForm && (
              <button
                onClick={() => { setShowForm(true); setEditingId(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'hsl(160 84% 27% / 0.08)', color: 'hsl(160 84% 27%)', border: '1.5px dashed hsl(160 84% 27% / 0.4)' }}
              >
                <Plus size={15} /> Nova Propriedade
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2 — Verify in dev server (component will be wired in Task 9)**

Run `npm run build` — expected: no errors.

- [ ] **Step 6.3 — Commit**
```bash
git add src/components/PropriedadesPage.jsx
git commit -m "feat: create PropriedadesPage (list, create, edit, delete)"
```

---

## Task 7: PropriedadePage.jsx — property detail

**Files:**
- Create: `src/components/PropriedadePage.jsx`

- [ ] **Step 7.1 — Create PropriedadePage**

Create `src/components/PropriedadePage.jsx`:
```jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Package2, Plus, Building2, Leaf, CheckCircle2, CalendarDays, AlertTriangle } from 'lucide-react';
import { loadLotesByPropriedade } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { CULTURAS } from '../data/culturas';
import { resolveLifecycle, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';

function LoteSummaryCard({ lote, onSelect }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;
  const cor = cultura.cor;
  const lc  = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita, faseAtual, faseIndex } = lc;
  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(lote)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: `${cor}15` }}>
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{cultura.nome}</span>
            {faseAtual && !prontoParaColheita && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: faseColor.bg, color: faseColor.text }}>
                <Leaf size={9} /> {faseAtual}
              </span>
            )}
            {prontoParaColheita && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-black" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[10px] text-muted-foreground">{prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }} />
      </div>
    </motion.button>
  );
}

export default function PropriedadePage({ propriedade, onBack, onSelectLote, onGoEstoque, onAddLote }) {
  const [lotes, setLotes]     = useState([]);
  const [alertas, setAlertas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadLotesByPropriedade(propriedade.id),
      loadEstoque(propriedade.id),
    ]).then(([ls, insumos]) => {
      setLotes(ls);
      setAlertas(insumos.filter(i => i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0).length);
      setLoading(false);
    });
  }, [propriedade.id]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Propriedades
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
              <Building2 size={22} color="white" />
            </div>
            <div>
              <h1 className="font-display text-white text-xl font-extrabold leading-tight">{propriedade.nome}</h1>
              {propriedade.descricao && (
                <p className="text-white/55 text-[12px] mt-0.5">{propriedade.descricao}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onGoEstoque}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold relative"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <Package2 size={13} /> Estoque
            {alertas > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: '#dc2626', color: '#fff' }}>
                {alertas}
              </span>
            )}
          </button>
          <button
            onClick={onAddLote}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <Plus size={13} /> Novo Lote
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="section-label">Lotes</p>
          <span className="text-[11px] text-muted-foreground">{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : lotes.length === 0 ? (
          <div className="card p-8 flex flex-col items-center gap-3 text-center">
            <Leaf size={32} className="opacity-30" />
            <p className="text-[14px] font-bold text-foreground">Nenhum lote nesta propriedade</p>
            <p className="text-[12px] text-muted-foreground">Adicione o primeiro lote clicando em "Novo Lote" acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lotes.map(lote => (
              <LoteSummaryCard key={lote.id} lote={lote} onSelect={onSelectLote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2 — Commit**
```bash
git add src/components/PropriedadePage.jsx
git commit -m "feat: create PropriedadePage (property detail with lotes + stock button)"
```

---

## Task 8: MigrationWizard.jsx — first-run migration

**Files:**
- Create: `src/components/MigrationWizard.jsx`

- [ ] **Step 8.1 — Create MigrationWizard component**

Create `src/components/MigrationWizard.jsx`:
```jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPropriedade } from '../hooks/useSupabaseSync';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Shown on first app load when propriedades table is empty
 * but the user has existing plantios or estoque_insumos.
 * Creates a single default property and migrates all existing data to it.
 */
export default function MigrationWizard({ onComplete }) {
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);

    const prop = await createPropriedade({ nome: nome.trim() });
    if (!prop) { setSaving(false); return; }

    const userId = await getUserId();
    if (userId) {
      // Migrate all existing plantios and estoque_insumos to the new property
      await Promise.all([
        supabase.from('plantios')
          .update({ propriedade_id: prop.id })
          .eq('user_id', userId)
          .is('propriedade_id', null),
        supabase.from('estoque_insumos')
          .update({ propriedade_id: prop.id })
          .eq('user_id', userId)
          .is('propriedade_id', null),
      ]);
    }

    setSaving(false);
    onComplete(prop);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{ background: '#fff' }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'hsl(160 84% 27% / 0.1)' }}>
            <Building2 size={28} style={{ color: 'hsl(160 84% 27%)' }} />
          </div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Organize seus lotes</h2>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
            O OryAgro agora organiza lotes e estoque por <strong>propriedade</strong>.
            Dê um nome para sua propriedade principal — todos os seus dados serão migrados automaticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome da propriedade (ex: Sítio Portuga)"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-2xl text-[14px] font-semibold outline-none"
            style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
          />
          <button
            type="submit"
            disabled={saving || !nome.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: 'hsl(160 84% 27%)' }}
          >
            {saving ? 'Migrando…' : <><span>Continuar</span><ArrowRight size={16} /></>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 8.2 — Commit**
```bash
git add src/components/MigrationWizard.jsx
git commit -m "feat: create MigrationWizard for first-run data migration"
```

---

## Task 9: Dashboard.jsx — property cards

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 9.1 — Update imports**

In `src/components/Dashboard.jsx`, add/update imports:
```js
import { loadTodosLotes, loadPropriedades } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { Building2, AlertTriangle } from 'lucide-react'; // add these to existing import
```

(Keep all other existing imports: `CULTURAS`, `resolveLifecycle`, etc.)

- [ ] **Step 9.2 — Add PropriedadeCard component (replace LoteCard for property view)**

Add a new `PropriedadeCard` component before `EmptyLotes`. This shows: property name, lote count, phase summary, next harvest, stock alert badge:
```jsx
function PropriedadeCard({ propriedade, lotes, alertasCount, onSelect, index }) {
  const lotesDaProp = lotes.filter(l => l.propriedade_id === propriedade.id);
  const ativos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && !resolveLifecycle(l, c).prontoParaColheita;
  });
  const prontos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && resolveLifecycle(l, c).prontoParaColheita;
  });

  // Find most urgent upcoming harvest among active lots
  let diasParaMaisUrgente = Infinity;
  ativos.forEach(l => {
    const c = CULTURAS[l.cultura_id];
    if (c) {
      const { diasParaColheita } = resolveLifecycle(l, c);
      if (diasParaColheita < diasParaMaisUrgente) diasParaMaisUrgente = diasParaColheita;
    }
  });

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(propriedade)}
      className="card-interactive w-full text-left p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(160 84% 27% / 0.1)' }}>
          <Building2 size={18} style={{ color: 'hsl(160 84% 27%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{propriedade.nome}</p>
            {alertasCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={9} /> {alertasCount}
              </span>
            )}
          </div>
          {propriedade.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{propriedade.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{lotesDaProp.length} lote{lotesDaProp.length !== 1 ? 's' : ''}</span>
            {ativos.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</span>
            )}
            {prontos.length > 0 && (
              <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>
                {prontos.length} pronto{prontos.length !== 1 ? 's' : ''} p/ colheita
              </span>
            )}
            {diasParaMaisUrgente < Infinity && (
              <span className="text-[11px] text-muted-foreground">
                próx. colheita: {fmtDiasRestantes(diasParaMaisUrgente)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="opacity-30 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}
```

Also add `ChevronRight` to lucide imports.

- [ ] **Step 9.3 — Update Dashboard main component**

Replace the `Dashboard` main component:
```jsx
export default function Dashboard({ onAddLote, onSelectLote, onSelectPropriedade, onManagePropriedades, onSignOut, userName }) {
  const [lotes, setLotes]               = useState([]);
  const [propriedades, setPropriedades] = useState([]);
  const [alertasPorProp, setAlertasPorProp] = useState({});
  const [loading, setLoading]           = useState(true);
  const [refreshKey, setRefreshKey]     = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadTodosLotes(100),
      loadPropriedades(),
      loadEstoque(), // load all to compute alerts per property
    ]).then(([ls, props, insumos]) => {
      setLotes(ls);
      setPropriedades(props);
      // Build alert counts per property
      const alerts = {};
      insumos.forEach(i => {
        if (i.propriedade_id && i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0) {
          alerts[i.propriedade_id] = (alerts[i.propriedade_id] || 0) + 1;
        }
      });
      setAlertasPorProp(alerts);
      setLoading(false);
    });
  }, [refreshKey]);

  // Lotes without a property
  const lotesOrfaos = lotes.filter(l => !l.propriedade_id);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden">
        {/* (keep all existing decorative divs) */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.06]">
          <Sprout size={120} color="white" />
        </div>

        <div className="relative z-10 px-5 pt-5 pb-6">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
                <Sprout size={18} color="white" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium">
                  {userName ? `Olá, ${userName.split('@')[0]}` : 'Guia Hortícola'}
                </p>
                <h1 className="font-display text-white text-xl font-extrabold leading-tight">OryAgro</h1>
              </div>
            </div>
            <button onClick={onSignOut} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors p-1.5">
              <LogOut size={15} />
            </button>
          </div>

          {/* Stats glass */}
          <div className="glass rounded-2xl p-4 mb-3" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.15)' }}>
              <div className="pr-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {loading ? '…' : propriedades.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Propriedades</p>
              </div>
              <div className="px-4">
                <p className="font-display text-white text-2xl font-black leading-none">
                  {loading ? '…' : lotes.length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Lotes</p>
              </div>
              <div className="pl-4">
                <p className="font-display text-white text-2xl font-black leading-none text-emerald-300">
                  {loading ? '…' : lotes.filter(l => { const c = CULTURAS[l.cultura_id]; return c && resolveLifecycle(l, c).prontoParaColheita; }).length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">P/ Colheita</p>
              </div>
            </div>
          </div>

          {/* Manage properties button */}
          <button
            onClick={onManagePropriedades}
            className="glass w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}
          >
            <Building2 size={15} color="white" />
            <span className="text-white text-[13px] font-bold">Gerenciar Propriedades</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'hsl(160 84% 27% / 0.4)', borderTopColor: 'hsl(160 84% 27%)' }}
            />
            Carregando…
          </div>
        ) : propriedades.length === 0 && lotes.length === 0 ? (
          <EmptyLotes onAdd={onManagePropriedades} />
        ) : (
          <>
            {/* Property cards */}
            {propriedades.length > 0 && (
              <div className="mb-5">
                <p className="section-label mb-3 px-1">Suas propriedades</p>
                <div className="space-y-3">
                  {propriedades.map((p, i) => (
                    <PropriedadeCard
                      key={p.id}
                      propriedade={p}
                      lotes={lotes}
                      alertasCount={alertasPorProp[p.id] || 0}
                      onSelect={onSelectPropriedade}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Orphaned lotes (no property) */}
            {lotesOrfaos.length > 0 && (
              <div>
                <p className="section-label mb-3 px-1 text-muted-foreground">Sem propriedade ({lotesOrfaos.length})</p>
                <div className="space-y-3">
                  {lotesOrfaos.map((l, i) => (
                    <LoteCard key={l.id} lote={l} onSelect={onSelectLote} index={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.4 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: Dashboard shows property cards instead of flat lote list"
```

---

## Task 10: LotesPage.jsx + CulturaPage.jsx — propriedadeId wiring

**Files:**
- Modify: `src/components/LotesPage.jsx`
- Modify: `src/components/CulturaPage.jsx`

- [ ] **Step 10.1 — LotesPage accepts propriedadeId and includes it in payload**

In `src/components/LotesPage.jsx`, update the component signature:
```js
// OLD:
export default function LotesPage({ cultura, calc, onCalcChange, lotes, loadingLotes, onLoteAdded, onLoteDeleted, autoOpenForm = false })

// NEW:
export default function LotesPage({ cultura, calc, onCalcChange, lotes, loadingLotes, onLoteAdded, onLoteDeleted, autoOpenForm = false, propriedadeId = null })
```

In `handleSalvar`, add `propriedade_id` to the payload (in the `const payload = { ... }` block, add it):
```js
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
    : { comprimento_m: parseFloat(calc.comprimento) || cultura.canteiro.comprimento, largura_m: parseFloat(calc.largura) || cultura.canteiro.largura }
  ),
};
```

- [ ] **Step 10.2 — CulturaPage accepts and forwards propriedadeId**

In `src/components/CulturaPage.jsx`, update the component signature:
```js
// OLD:
export default function CulturaPage({ cultura, onBack, autoOpenLoteForm = false })

// NEW:
export default function CulturaPage({ cultura, onBack, autoOpenLoteForm = false, propriedadeId = null })
```

In the JSX where `LotesPage` is rendered (around line 158), pass `propriedadeId`:
```jsx
{tab === 'lotes' && (
  <LotesPage
    cultura={cultura}
    calc={calc}
    onCalcChange={setCalc}
    lotes={lotes}
    loadingLotes={loadingLotes}
    onLoteAdded={handleLoteAdded}
    onLoteDeleted={handleLoteDeleted}
    autoOpenForm={autoOpenLoteForm}
    propriedadeId={propriedadeId}
  />
)}
```

- [ ] **Step 10.3 — Commit**
```bash
git add src/components/LotesPage.jsx src/components/CulturaPage.jsx
git commit -m "feat: LotesPage + CulturaPage accept propriedadeId, saved in new lotes"
```

---

## Task 11: App.jsx — full wiring

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 11.1 — Import new components**

In `src/App.jsx`, add imports:
```js
import PropriedadesPage from './components/PropriedadesPage';
import PropriedadePage from './components/PropriedadePage';
import MigrationWizard from './components/MigrationWizard';
import { loadPropriedades, loadTodosLotes } from './hooks/useSupabaseSync';
import { Building2 } from 'lucide-react'; // add to existing lucide import
```

Remove `Package2` from lucide import (Estoque removed from navbar) and remove `EstoquePage` import if no longer needed directly (it's now used via PropriedadePage).

Keep: `import EstoquePage from './components/EstoquePage';` — it's still used when navigating from PropriedadePage.

- [ ] **Step 11.2 — Update BOTTOM_NAV — remove Estoque**

```js
const BOTTOM_NAV = [
  { value: 'dashboard',  label: 'Início',     Icon: Home },
  { value: 'calendario', label: 'Calendário', Icon: CalendarDays },
  { value: 'analise',    label: 'Análise',    Icon: Activity },
  { value: 'comparacao', label: 'Comparar',   Icon: BarChart2 },
];
```

- [ ] **Step 11.3 — Add state for property navigation + migration wizard**

Inside `App()`, after existing state declarations, add:
```js
const [selectedPropriedade, setSelectedPropriedade] = useState(null);
const [showMigrationWizard, setShowMigrationWizard] = useState(false);

// Check on mount whether migration wizard is needed
useEffect(() => {
  if (!session) return;
  Promise.all([loadPropriedades(), loadTodosLotes(1)]).then(([props, lotes]) => {
    if (props.length === 0 && lotes.length > 0) {
      setShowMigrationWizard(true);
    }
  });
}, [session]);
```

- [ ] **Step 11.4 — Add navigation handlers for properties**

Add after existing handlers:
```js
// From Dashboard: user clicks a property card
const handleSelectPropriedade = (propriedade) => {
  setSelectedPropriedade(propriedade);
  setMainView('propriedade');
};

// From Dashboard: user clicks "Gerenciar Propriedades"
const handleManagePropriedades = () => {
  setMainView('propriedades');
};

// From PropriedadesPage: click on a property
const handleSelectPropriedadeFromList = (propriedade) => {
  setSelectedPropriedade(propriedade);
  setMainView('propriedade');
};

// Back from PropriedadesPage → dashboard
const handleBackFromPropriedades = () => {
  setMainView('dashboard');
};

// Back from PropriedadePage → propriedades list
const handleBackFromPropriedade = () => {
  setSelectedPropriedade(null);
  setMainView('propriedades');
};

// From PropriedadePage: "Estoque" button
const handleGoEstoque = () => {
  setMainView('estoque');
};

// Back from EstoquePage → PropriedadePage
const handleBackFromEstoque = () => {
  setMainView('propriedade');
};

// From PropriedadePage: "+ Novo Lote" button
const handleAddLoteFromPropriedade = () => {
  setMainView('cultura-picker');
};

// From PropriedadePage → select a lote
const handleSelectLoteFromPropriedade = (lote) => {
  setSelectedLote(lote);
  setMainView('lote');
};
```

- [ ] **Step 11.5 — Update the isInCultura and animationKey logic**

The `isInCultura` variable and the motion key need to include the new views:
```js
const isInCultura = (mainView === 'cultura' && cultura) || (mainView === 'lote' && selectedLote);
const activeCultura = mainView === 'lote' && selectedLote ? CULTURAS[selectedLote.cultura_id] : cultura;
```
(These remain unchanged — the new views don't affect this.)

The `key` for AnimatePresence:
```js
key={
  mainView === 'cultura'       ? `cultura-${culturaId}` :
  mainView === 'lote'          ? `lote-${selectedLote?.id}` :
  mainView === 'cultura-picker' ? 'cultura-picker' :
  mainView === 'propriedade'   ? `propriedade-${selectedPropriedade?.id}` :
  mainView
}
```

- [ ] **Step 11.6 — Add new views to JSX render block**

Inside the `<AnimatePresence>` motion div, add:
```jsx
{mainView === 'dashboard' && (
  <Dashboard
    onAddLote={handleAddLote}
    onSelectLote={handleSelectLote}
    onSelectPropriedade={handleSelectPropriedade}
    onManagePropriedades={handleManagePropriedades}
    onSignOut={signOut}
    userName={user?.email}
  />
)}

{/* ... existing views ... */}

{mainView === 'propriedades' && (
  <PropriedadesPage
    onBack={handleBackFromPropriedades}
    onSelectPropriedade={handleSelectPropriedadeFromList}
  />
)}
{mainView === 'propriedade' && selectedPropriedade && (
  <PropriedadePage
    propriedade={selectedPropriedade}
    onBack={handleBackFromPropriedade}
    onSelectLote={handleSelectLoteFromPropriedade}
    onGoEstoque={handleGoEstoque}
    onAddLote={handleAddLoteFromPropriedade}
  />
)}
{mainView === 'estoque' && (
  <EstoquePage propriedadeId={selectedPropriedade?.id ?? null} />
)}

{/* CulturaPage: pass propriedadeId so new lotes are linked to property */}
{mainView === 'cultura' && cultura && (
  <CulturaPage
    cultura={cultura}
    onBack={handleBack}
    autoOpenLoteForm={autoOpenLoteForm}
    propriedadeId={selectedPropriedade?.id ?? null}
  />
)}
```

Remove the old `{mainView === 'estoque' && <EstoquePage />}` line.

- [ ] **Step 11.7 — Add MigrationWizard to render**

Just before `</div>` closing the main app div, add:
```jsx
{showMigrationWizard && (
  <MigrationWizard
    onComplete={(prop) => {
      setShowMigrationWizard(false);
      setSelectedPropriedade(prop);
    }}
  />
)}
```

- [ ] **Step 11.8 — Commit**
```bash
git add src/App.jsx
git commit -m "feat: wire up property navigation in App, remove Estoque from navbar"
```

---

## Task 12: CronogramaTimeline.jsx — stock deduction on step completion

**Files:**
- Modify: `src/components/CronogramaTimeline.jsx`

- [ ] **Step 12.1 — Add propriedadeId prop and load insumos**

Update the component signature to accept `propriedadeId`:
```js
export default function CronogramaTimeline({ cultura, lotes = [], propriedadeId = null })
```

Add state for insumos (needed for deduction dropdown):
```js
const [insumos, setInsumos] = useState([]);
```

Add effect to load insumos when propriedadeId changes:
```js
useEffect(() => {
  if (!propriedadeId) return;
  loadEstoque(propriedadeId).then(setInsumos);
}, [propriedadeId]);
```

Add the import at the top of the file:
```js
import { loadEstoque, addMovimento } from '../hooks/useGestao';
```

- [ ] **Step 12.2 — Add state for stock deduction inline confirm**

Add state after existing state declarations:
```js
const [stockDebit, setStockDebit] = useState({
  enabled: false,
  insumoId: '',
  quantidade: '',
});
```

Reset `stockDebit` when a new step begins confirming:
```js
// In the CTA button onClick:
onClick={() => {
  setConfirmDate(getDefaultConfirmDate(ev.dia));
  setConfirming({ id: ev._id, etapa: ev.etapa, tipo: ev.tipo });
  setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
}}
```

Update the existing `setConfirming` call (in the CTA button `onClick`) to also pass `tipo` so the stock UI knows whether to show the deduction toggle:
```js
// In the CTA button's onClick, replace existing setConfirming call:
onClick={() => {
  setConfirmDate(getDefaultConfirmDate(ev.dia));
  setConfirming({ id: ev._id, etapa: ev.etapa, tipo: ev.tipo });
  setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
}}
```

- [ ] **Step 12.3 — Update confirmStep to optionally debit stock**

Replace the current `confirmStep` function:
```js
const confirmStep = async (id) => {
  setStatus(s => ({ ...s, [id]: { status: 'feito', data: confirmDate } }));

  // Debit stock if enabled and valid
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
    // Refresh insumos list so quantities are up to date
    if (propriedadeId) loadEstoque(propriedadeId).then(setInsumos);
  }

  setConfirming(null);
  setStockDebit({ enabled: false, insumoId: '', quantidade: '' });
};
```

Note: `confirmStep` now takes `(id, tipo)`. Pass the tipo from confirming: `confirmStep(confirming.id, confirming.tipo)`.

- [ ] **Step 12.4 — Add stock-deduction UI inside the inline confirm form**

Find the inline confirm form block in the JSX (around line 614 in the original). Inside it, after the date input and before the buttons, add the stock deduction section — but only if the step tipo is `adubo` or `foliar` AND insumos are available:

```jsx
{/* Stock deduction toggle — only for adubo/foliar steps with stock available */}
{(confirming?.tipo === 'adubo' || confirming?.tipo === 'foliar') && insumos.length > 0 && (
  <div>
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold" style={{ color: meta.color }}>Debitar do estoque</span>
      <button
        type="button"
        onClick={() => setStockDebit(s => ({ ...s, enabled: !s.enabled }))}
        className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
        style={{ background: stockDebit.enabled ? meta.color : 'hsl(210 16% 88%)' }}
      >
        <span
          className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all"
          style={{ left: stockDebit.enabled ? '1.375rem' : '0.125rem' }}
        />
      </button>
    </div>

    {stockDebit.enabled && (
      <motion.div
        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
        style={{ overflow: 'hidden' }}
        className="mt-2 space-y-2"
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
                {i.nome} ({i.quantidade} {i.unidade} disponíveis)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Quantidade ({stockDebit.insumoId ? (insumos.find(i => i.id === stockDebit.insumoId)?.unidade || '') : ''})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={stockDebit.quantidade}
            onChange={e => setStockDebit(s => ({ ...s, quantidade: e.target.value }))}
            placeholder={scaledDose && scaledDose !== '—' ? scaledDose.match(/[\d.,]+/)?.[0] || '' : ''}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none"
            style={{ background: 'white', borderColor: `${meta.color}40` }}
          />
        </div>
      </motion.div>
    )}
  </div>
)}
```

The confirm button now calls `confirmStep(ev._id)` (tipo is read from `confirming` state inside the function):
```jsx
<button
  onClick={() => confirmStep(ev._id)}
  className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white transition-colors"
  style={{ background: meta.color }}
>
  ✓ Confirmar
</button>
```

- [ ] **Step 12.5 — Add optional insumo link when adding a custom item**

In the Add Dialog, add an optional insumo selector that appears when `tipo === 'adubo' || tipo === 'foliar'` and insumos are available. Add to `newRow` state: `insumo_id: ''`.

Update the initial newRow state:
```js
const [newRow, setNewRow] = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo', insumo_id: '' });
```

In the Dialog form body, after the `forma` textarea and before DialogFooter:
```jsx
{(newRow.tipo === 'adubo' || newRow.tipo === 'foliar') && insumos.length > 0 && (
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
```

In the Adicionar button's `onClick`, save `insumo_id` in the custom row:
```jsx
onClick={() => {
  if (!newRow.etapa) return;
  setCustomRows(r => [
    ...r,
    { ...newRow, dia: parseInt(newRow.dia) || 0, insumo_id: newRow.insumo_id || null },
  ]);
  setNewRow({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo', insumo_id: '' });
  setAddDialog(false);
}}
```

- [ ] **Step 12.6 — Pass propriedadeId from CulturaPage to CronogramaTimeline**

In `src/components/CulturaPage.jsx`, the Cronograma tab renders:
```jsx
{tab === 'cronograma' && <CronogramaTimeline cultura={cultura} lotes={lotes} />}
```

Update to pass `propriedadeId`:
```jsx
{tab === 'cronograma' && (
  <CronogramaTimeline cultura={cultura} lotes={lotes} propriedadeId={propriedadeId} />
)}
```

- [ ] **Step 12.7 — Commit**
```bash
git add src/components/CronogramaTimeline.jsx src/components/CulturaPage.jsx
git commit -m "feat: CronogramaTimeline — optional stock deduction on step completion"
```

---

## Task 13: Final build verification

- [ ] **Step 13.1 — Run full build**

```bash
npm run build
```
Expected: Build completes with no errors. Warnings are acceptable.

- [ ] **Step 13.2 — Manual smoke test checklist**

Run `npm run dev` and verify:

1. **Dashboard** shows property cards (not flat lote list) after having at least one property
2. **MigrationWizard** appears on first load when there are existing lotes but no properties
3. **"Gerenciar Propriedades"** button in Dashboard goes to PropriedadesPage
4. **PropriedadesPage** — can create, edit, delete properties
5. **PropriedadePage** — shows lotes, Estoque button with alert badge
6. **EstoquePage** — button not overlapping navbar; insumos filtered by property
7. **New lote** (via "+ Novo Lote" from PropriedadePage) saves with correct `propriedade_id`
8. **Cronograma** — marking an adubo/foliar step shows "Debitar do estoque" toggle; selecting insumo + qty and confirming reduces stock
9. **Mamão** with `muda_saquinho` — no duplicate "Viveiro" or "Transplante" steps in base timeline
10. **Bottom navbar** — no Estoque item (4 items: Início, Calendário, Análise, Comparar)

- [ ] **Step 13.3 — Final commit**

```bash
git add -A
git commit -m "feat: propriedades layer, per-property stock, cronograma stock integration, mamão bug fix"
```
