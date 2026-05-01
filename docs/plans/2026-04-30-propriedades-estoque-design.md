# OryAgro — Propriedades, Estoque por Propriedade e Integração Cronograma × Estoque

> **Design aprovado em 2026-04-30**

---

## Objetivo

Reorganizar os lotes sob uma camada de **Propriedade/Projeto**, tornar o estoque por propriedade, integrar débito automático do estoque ao concluir etapas no cronograma, e corrigir bugs pontuais (mamão, botão estoque).

---

## Bugs a corrigir (pré-requisito)

### 1. Mamão — passos duplicados no cronograma
**Causa:** o cronograma base do `mamao_tainung` tem dia 0 ("Viveiro — produção de mudas") e dia 45 ("Transplante ao campo") que duplicam os passos de `etapasViveiro` após o lifecycle scaling ser aplicado.

**Fix:** remover esses dois passos do cronograma base. Adicionar filtro defensivo em `CronogramaTimeline.allEvents`: quando `etapasViveiro` tiver um passo com `tipo === 'especial'` (transplante), ignorar o passo base com `dia === 0 && tipo === 'plantio'`.

**Verificar também:** acerola e banana por colisão similar.

### 2. Botão "Adicionar insumo" sobrepondo navbar
**Fix:** ao mover estoque para dentro de `PropriedadePage`, o layout será reconstruído sem o conflito. Se ainda ocorrer, ajustar padding-bottom da página.

---

## Arquitetura de navegação

```
App
├── Dashboard
│   ├── Cards de propriedades (clicáveis, com resumo dos lotes)
│   └── Botão "Gerenciar Propriedades" → PropriedadesPage
├── PropriedadesPage  (criar / editar / excluir propriedades)
├── PropriedadePage   (lotes + botão Estoque + botão Novo Lote)
│   ├── EstoquePage   (filtrado por propriedade)
│   └── LotePage      (sem mudança estrutural)
├── CulturaPicker → CulturaPage (cadastro de lote requer propriedade)
└── Bottom navbar: Início · Calendário · Análise · Comparar  (Estoque removido)
```

---

## Banco de dados

### Tabela `propriedades` (nova)
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
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### Coluna `propriedade_id` em `plantios`
```sql
ALTER TABLE plantios
  ADD COLUMN propriedade_id uuid REFERENCES propriedades(id) ON DELETE SET NULL;
```

### Coluna `propriedade_id` em `estoque_insumos`
```sql
ALTER TABLE estoque_insumos
  ADD COLUMN propriedade_id uuid REFERENCES propriedades(id) ON DELETE CASCADE;
```

### Coluna `plantio_id` em `estoque_movimentos`
```sql
ALTER TABLE estoque_movimentos
  ADD COLUMN plantio_id uuid REFERENCES plantios(id) ON DELETE SET NULL;
```

---

## Componentes novos / modificados

### `PropriedadesPage` (novo)
- Lista cards de todas as propriedades do usuário
- Cada card: nome, descrição, nº lotes, nº insumos, badge alerta estoque baixo
- Botão "+ Nova Propriedade" → formulário inline (nome obrigatório, descrição opcional)
- Botão excluir por card (com confirmação)

### `PropriedadePage` (novo)
- Header: nome + descrição da propriedade
- Botão "📦 Estoque" → navega para EstoquePage com `propriedadeId`
- Botão "+ Novo Lote" → CulturaPicker com `propriedadeId` pré-selecionado
- Lista de LoteCards da propriedade (mesma renderização atual)
- Botão voltar → Dashboard

### `Dashboard` (modificado)
- Remove lista flat de lotes
- Mostra **cards de propriedade** clicáveis com:
  - Nome da propriedade
  - Lotes ativos (count) e culturas em andamento
  - Fase + próxima colheita mais urgente entre todos os lotes
  - Badge vermelho/amarelo se estoque abaixo do mínimo
- Botão "Gerenciar Propriedades" no topo (leva a PropriedadesPage)
- Lotes sem propriedade aparecem em seção "Sem propriedade" (migração)

### `EstoquePage` (modificado)
- Recebe prop `propriedadeId`
- Todas as queries (`loadEstoque`, `upsertInsumo`, `deleteInsumo`, `addMovimento`) passam `propriedade_id`
- Histórico de movimentações: mostra "Uso — Lote [nome]" para saídas com `plantio_id`
- Layout: botão "+ Adicionar insumo" no header da página (não dentro do hero sobreposto)

### `LotesPage` / cadastro de lote (modificado)
- Campo "Propriedade" obrigatório no formulário de novo lote
- Seletor: lista propriedades existentes + opção "＋ Criar nova propriedade"
- Salva `propriedade_id` no `registrarPlantio` payload

### `CulturaPage` / `App.jsx` (modificado)
- `App.jsx`: adiciona views `propriedades`, `propriedade`, `estoque`; remove `estoque` do navbar
- Passa `propriedadeId` para CulturaPicker → CulturaPage → LotesPage
- PropriedadePage passa `propriedadeId` para EstoquePage

### `CronogramaTimeline` (modificado)
**Ao marcar etapa como concluída (`tipo === 'adubo' | 'foliar'`):**
1. Após confirmar data, exibe toggle "Debitar do estoque"
2. Se ativado: dropdown com insumos da propriedade + quantidade (pré-preenchida com dose escalonada)
3. On confirm: `addMovimento({ tipo: 'saida', insumoId, quantidade, plantioId: lote.id, data })`

**Ao adicionar item customizado:**
1. Se `tipo === 'adubo' | 'foliar'`: aparece campo "Vincular a insumo do estoque" (opcional)
2. Seletor de insumo da propriedade + quantidade
3. Ao salvar: cria o custom step com `insumo_id` opcionalmente vinculado

---

## Hooks novos / modificados

### `useSupabaseSync.js`
```js
loadPropriedades()          // lista propriedades do usuário
createPropriedade(payload)  // insert
updatePropriedade(id, data) // update
deletePropriedade(id)       // delete

loadLotesByPropriedade(propriedadeId)  // plantios filtrados
```

### `useGestao.js`
```js
loadEstoque(propriedadeId)             // filtro por propriedade
upsertInsumo({ ...payload, propriedadeId })
addMovimento({ ...payload, plantioId }) // inclui plantio_id
loadMovimentos(insumoId)               // sem mudança
```

---

## Wizard de migração (first-run)

Na primeira abertura pós-deploy, se `propriedades` estiver vazia mas existirem `plantios` ou `estoque_insumos` do usuário:

1. Tela única sobreposta: "Organize seus lotes em propriedades"
2. Campo: "Nome da propriedade" (placeholder: "Sítio Portuga")
3. Ao confirmar: cria propriedade + faz `UPDATE plantios SET propriedade_id = <id> WHERE user_id = <uid>` + `UPDATE estoque_insumos SET propriedade_id = <id> WHERE user_id = <uid>`
4. Desaparece e exibe o Dashboard normal

---

## Regras de consistência

- Todo lote novo **deve** ter `propriedade_id` (obrigatório no formulário)
- Insumo só aparece no seletor do cronograma se pertencer à **mesma propriedade** do lote
- Movimentação do tipo `saida` gerada pelo cronograma **sempre** inclui `plantio_id`
- Excluir propriedade: bloquear se tiver lotes vinculados (ON DELETE SET NULL torna o lote "órfão" — preferível alertar e pedir migração antes)

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/App.jsx` | Modificar: views, navbar |
| `src/components/Dashboard.jsx` | Modificar: cards de propriedade |
| `src/components/PropriedadesPage.jsx` | Criar |
| `src/components/PropriedadePage.jsx` | Criar |
| `src/components/EstoquePage.jsx` | Modificar: prop propriedadeId, layout |
| `src/components/LotesPage.jsx` | Modificar: campo propriedade no form |
| `src/components/CronogramaTimeline.jsx` | Modificar: stock integration |
| `src/components/CulturaPage.jsx` | Modificar: passa propriedadeId |
| `src/hooks/useSupabaseSync.js` | Modificar: funções de propriedade |
| `src/hooks/useGestao.js` | Modificar: propriedadeId em estoque |
| `src/data/culturas.js` | Modificar: fix mamão cronograma |
| `supabase/migrations/` | Criar: 4 arquivos de migração SQL |
