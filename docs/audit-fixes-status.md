# OryAgro — Status dos Fixes das 3 Auditorias

> Última atualização: 2026-05-24 (sessão 2)

---

## ✅ Implementado (47 fixes)

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
| **SYNC ESTOQUE** | Auto-match insumo ao confirmar etapa do cronograma; pre-fill stockDebit; badge "auto"; aviso de estoque insuficiente | CronogramaTimeline.jsx |
| Op#2 | `mao_obra_registros` como fonte autoritativa; fallback para `mao_obra_total`; label "(registros)"/"(estimativa)" no AnalysePage | useGestao.js, AnalysePage.jsx, FinanceiroPage.jsx |
| Arch#3 | deletePropriedade/deleteLoteCompleto com verificação de erro em cada passo + rollback logging | useSupabaseSync.js |
| Arch#7 | getUserId() centralizado em lib/supabase.js (getSession, sem round-trip); 6 arquivos atualizados | supabase.js, todos os hooks |
| BUG-06 | Validação JS para total_plantas = 0 adicionada ao handleSalvar | LotesPage.jsx |
| BUG-18 | visualViewport.resize → scrollIntoView para teclado virtual Android | App.jsx |
| BUG-19 | storage event listener — notifica ao detectar mudanças de outra aba (throttle 30s) | App.jsx |
| Op#11 | IDs de custom activities agora usam hash(etapa+dia) estável; retrocompat com índice | CronogramaTimeline.jsx |
| Op#5 | Fórmula de lucro idêntica em FinanceiroPage e AnalysePage via `calcLucroLote()` | lib/financeiro.js |
| Arch#2 | `src/lib/financeiro.js` criado — mão de obra isolada; custo total reconciliado | lib/financeiro.js (novo) |
| Op#6 | ProjecaoKgCard mostra produtividade real dos lotes colhidos; Embrapa como secundário | AnalysePage.jsx |
| Arch#1 | LotePage.jsx: 2208 → 634 linhas; tabs extraídas para `src/components/lote/` | TabInsumos, TabDiario, TabDespesas, TabReceitas, shared.js |
| Op#8 | Preços de insumos sincronizados via `simulador_configs` (sem migration); badge "☁ salvo"; Supabase ganha no merge cross-device | TabInsumos.jsx, useGestao.js |

---

## ❌ Pendente

### 🔴 Crítico

| ID | Arquivo | Descrição |
|---|---|---|
### ⚪ Baixo / Arquitetural — Requerem planejamento dedicado

| ID | Arquivo | Motivo do adiamento |
|---|---|---|
| Arch#6 | App.jsx | React Router — refactor grande; precisa de plano/worktree dedicado |
| Arch#9 | 14 arquivos | 55 chamadas localStorage — migração gradual, requer testes |
~~Op#8~~ | ✅ resolvido — ver seção implementado acima |

