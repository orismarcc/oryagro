# OryAgro — Status dos Fixes das 3 Auditorias

> Última atualização: 2026-05-24

---

## ✅ Implementado (31 fixes)

| ID | Descrição | Arquivo |
|---|---|---|
| BUG-01 | Guard `isSubmitting` (ref) — duplo submit bloqueado no TabDiario | LotePage.jsx |
| BUG-02 completo | Toast de erro conectado em TabDiario, TabDespesas, TabReceitas, handleConcluir | LotePage.jsx |
| BUG-03 | Toast de erro no handleConcluir; proteção de estado parcial | LotePage.jsx |
| BUG-04 | Delete de venda com confirmação em 2 cliques | LotePage / TabReceitas |
| BUG-05/23 | `.catch()` no Promise.all do Dashboard — loading não trava | Dashboard.jsx |
| BUG-07 | `maxLength` nos textareas de TabDiario e TabReceitas | LotePage.jsx |
| BUG-08 | Labels das abas sempre visíveis (removido `hidden sm:inline`) | LotePage.jsx |
| BUG-09 | Touch targets 44px — EstoquePage e LotePage | EstoquePage.jsx, LotePage.jsx |
| BUG-10 | `overscrollBehavior: contain` no BottomSheet do EstoquePage | EstoquePage.jsx |
| BUG-11 | Detecção de sessão expirada com toast.warning | App.jsx |
| BUG-12 | Duplicate `style` prop na NotificacoesBell corrigido | NotificacoesBell.jsx |
| BUG-13 | Cache offline cache-first com fallback offline | CalendarioPage.jsx |
| BUG-14 | `makeStableId` deduplicado — removidas cópias de CronogramaTimeline, CalendarioPage, LotePage | 3 arquivos |
| BUG-15 | Aviso ao salvar receita com preço R$ 0,00 | LotePage / TabReceitas |
| BUG-16 | Saída do estoque maior que disponível exige confirmação | EstoquePage.jsx |
| BUG-17 | Aviso ao concluir lote com zero vendas | LotePage.jsx |
| BUG-20 | Contraste de muted-foreground aumentado para texto pequeno | index.css |
| BUG-21 | Delay de animação limitado a 0.32s com muitos lotes | Dashboard.jsx |
| BUG-22 | Badge "dados do cache" quando CalendarioPage usa cache > 1h | CalendarioPage.jsx |
| BUG-24 | Email limpo ao trocar modo no LoginPage | LoginPage.jsx |
| BUG-25 | N queries → 1 batch query para movimentos do EstoquePage | EstoquePage.jsx + useGestao.js |
| Arch#4 / Op#4 | `parseCicloDias` duplicado removido do AnalysePage | AnalysePage.jsx |
| Arch#12 | Formatadores centralizados | src/lib/format.js (novo) |
| Op#1 | `handleConcluir` arquiva `despesas` corretamente | LotePage.jsx |
| Op#9 | Despesas sem `plantio_id` exibidas como custos indiretos no DRE | FinanceiroPage.jsx |
| Op#12 | `CustoProducaoCard` inclui tabela `despesas` no custo total | AnalysePage.jsx |
| Op#15 | Custo por planta exibido no breakdown do CustoProducaoCard | AnalysePage.jsx |
| ToastContext | Sistema global de toasts criado e conectado | ToastContext.jsx (novo) |
| **CRONOGRAMA** | Bug "HOJE" para lotes com plantio futuro corrigido; banner informativo | CronogramaTimeline.jsx, Dashboard.jsx |

---

## ❌ Pendente

### 🔴 Crítico

| ID | Arquivo | Descrição |
|---|---|---|
| Op#2 | Todo o app | Mão de obra contada em 3 fontes conflitantes — sem reconciliação (campo `mao_obra_total`, tabela `mao_obra_registros`, tabela `despesas`) |
| Op#3 | EstoquePage / MovModal | Saída de estoque sem `plantio_id` — consumo não reflete no custo do lote |
| Arch#3 | useSupabaseSync.js | `deletePropriedade`/`deleteLoteCompleto` sem transação — risco de estado inconsistente em falha |

### 🟠 Alto

| ID | Arquivo | Descrição |
|---|---|---|
| BUG-06 | LotesPage (formulário) | Validação JS faltante para `total_plantas = 0` — verificar se já cobre |
| BUG-18 | Formulários na parte inferior | Teclado virtual Android cobre inputs — sem `scrollIntoView` |
| Op#5 | FinanceiroPage / AnalysePage | DRE e Análise ainda podem divergir no lucro do mesmo lote |
| Op#7 | EstoquePage MovModal | Saídas sem `plantio_id` — rastreabilidade quebrada |
| Arch#7 | 12+ arquivos | `getUserId()` duplicado — round-trips desnecessários ao Supabase Auth |

### 🟡 Médio

| ID | Arquivo | Descrição |
|---|---|---|
| BUG-19 | App global | Múltiplas abas divergem sem sincronização |
| Op#6 | AnalysePage | Produtividade usa sempre benchmark Embrapa, nunca dados reais do histórico |

### ⚪ Baixo / Arquitetural

| ID | Arquivo | Descrição |
|---|---|---|
| Arch#1 | LotePage.jsx | ~2200 linhas — separar cada tab em arquivo próprio |
| Arch#2 | src/lib/financeiro.js | 3 fontes de custo sem reconciliação central |
| Arch#6 | App.jsx | Roteamento por estado — sem URL, histórico ou deep link |
| Arch#9 | 14 arquivos | localStorage como banco paralelo — 55 ocorrências |
| Op#11 | CronogramaTimeline | IDs de atividades customizadas baseados em índice de array — instáveis |
| Op#8 | TabInsumos | Preços dos insumos salvos só no localStorage — perdidos ao trocar de dispositivo |
