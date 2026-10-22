# OryAgro — guia do projeto para o Claude

## 1. O que é o projeto
App de gestão agrícola (PWA + APK Android) para o produtor anotar o que faz em cada lote (adubação, defensivo, colheita, compra), controlar estoque e finanças e consultar guias técnicos por cultura. Público: o próprio dono (pequeno produtor em Confresa/MT) e técnicos/membros convidados da propriedade; uso em campo, muitas vezes sem sinal.

## 2. Como eu quero que você trabalhe
- Responda sempre em **português**, inclusive nas mensagens curtas entre ferramentas.
- **Commit só quando eu pedir. Push e deploy (Vercel/APK) só com minha autorização.**
- Teste no navegador o que for visível. A maioria das telas exige login: sem credencial, valide com um harness temporário em `src/main.jsx` e **diga claramente o que não pôde ser testado**. Nunca commite o harness.
- Banco: com o conector MCP do Supabase disponível (`.mcp.json`), aplique a migration você mesmo, **verifique o resultado com uma consulta** e salve o mesmo SQL em `supabase/migrations/AAAAMMDD_nome.sql` (histórico local = remoto). Para testar gatilhos, use transação que termina em `RAISE EXCEPTION` (tudo é desfeito).
- Não invente: em doses, regras agronômicas ou dados do usuário, siga o guia da cultura (`src/data/culturas.js`) e pergunte quando faltar informação.

## 3. Infraestrutura
| Serviço | Identificador |
|---|---|
| GitHub | `orismarcc/oryagro`, branch `master` |
| Supabase (Postgres, Auth, Storage) | projeto `yjwwbynuqnfqkjdoexhm` |
| Supabase Storage | bucket privado `oryagro-attachments` (fotos dos registros) |
| Vercel | projeto `oryagro` (`prj_12WbKrOQwd6vR4Zzw8Q7sdchPkAN`, time `team_Ljm5PgjI6A4F49Q2TwF7dNcR`) → https://oryagro.vercel.app — **sem integração Git**: só publica via `vercel --prod` |
| Android (Capacitor 8) | `appId com.oryagro.app`, config em `capacitor.config.json` |
| APIs externas (sem chave) | Open-Meteo (clima/geocoding), tiles OSM e Esri ArcGIS |

**Fora do Git (precisam acompanhar a pasta):** `.env.local` (URL/anon key do Supabase + `SUPABASE_ACCESS_TOKEN`), `.vercel/project.json`, `supabase/.temp/` (project-ref usado por `npm run schema:check`), `.git/hooks/pre-commit` (validador de migrations). Recriáveis: `node_modules/`, `dist/`, `android/app/build`, `android/build`, `android/.gradle`, `android/app/src/main/assets/` (gerado por `npx cap sync`).

## 4. Segurança
- O frontend só conhece `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.js`). **Nunca** coloque `SUPABASE_ACCESS_TOKEN`, service role ou qualquer segredo em variável `VITE_*` nem em código do `src/`. `.env*` e `*.key/*.pem/*.jks` estão no `.gitignore`.
- Toda proteção de dados é **RLS no Postgres**: as 25 tabelas de `public` têm RLS ligado. Padrão: dono por `user_id = auth.uid()`; compartilhamento por propriedade via `farm_members` e as funções `is_farm_member()` / `is_farm_admin()`. Tabelas filhas (ex.: `cronograma_atividades`) checam o dono pelo `plantio_id`.
- **Toda tabela nova precisa:** RLS ligado + policy (dono e/ou membro da fazenda); `user_id` quando for dado do usuário; índice nas FKs. Funções `SECURITY DEFINER` devem ter `SET search_path = public` e checar `auth.uid()` quando agirem em nome do usuário.
- Storage: arquivos em `user/<auth.uid()>/...` (policies `anexos_storage_*`); exibir sempre por URL assinada (`createSignedUrls`), nunca bucket público.
- Papéis na UI: `src/lib/permissions.js` (`can(role, FARM_ACTIONS.X)`; papéis `admin` e `technician`). É conveniência de interface — a garantia real é o RLS.
- CSP restritiva em `vercel.json`: todo host externo novo precisa entrar na diretiva certa (`connect-src`, `img-src`…), senão falha em silêncio só em produção.
- Postgres 15: `CREATE POLICY IF NOT EXISTS` não existe — use `DROP POLICY IF EXISTS ...; CREATE POLICY ...` (o `scripts/validate-migrations.js` barra isso no commit).

## 5. Modelo de dados e regras de negócio
`propriedades` → `talhoes` (área física, mapa GPS) → `plantios` (= **lote**/safra; `cultura_id` aponta para `src/data/culturas.js`) → `cronograma_atividades` (**registros** do produtor), `despesas`, `vendas` + `venda_parcelas`, `producao_registros`, `atividade_fotos`. Estoque por propriedade: `estoque_insumos` → `estoque_movimentos`. Outras: `farm_members`, `audit_log`, `curvas_producao`, `simulador_configs`, `ciclos_historico`, `compradores`.

Regras não óbvias:
- **Nada é previsto pelo sistema.** O cronograma do lote é só o que o produtor anota: `status` `feito` (com `data_execucao`) ou `agendado` (com `data_prevista`). `pendente`/`removida` são legado do antigo plano-guia e não aparecem. O guia da cultura (`GuiaCultura.jsx`) é **só consulta**.
- **Estoque, colheita e despesa são mantidos por gatilhos no banco** (migration `20261007_estoque_e_registros_no_banco.sql`). **Nunca dê baixa, estorno ou ajuste de saldo pelo app** — isso contaria em dobro.
  - O saldo do insumo é o efeito das movimentações (`tg_estoque_movimentos_saldo`). Insumo novo nasce com quantidade 0 e recebe uma "entrada".
  - Um registro `feito` com `insumo_id` gera saída automática, com conversão g→kg e mL→L (`fn_qtd_na_unidade`); editar, reabrir ou excluir refaz ou estorna. Máximo de uma saída por registro.
  - Um registro de colheita `feito` com quantidade vira `producao_registros` (`atividade_id`).
  - Editar uma despesa ajusta a entrada vinculada; excluir a despesa estorna.
  - As RPCs `adjust_insumo_quantidade` e `delete_movimento_with_balance` existem só para compatibilidade com APKs antigos.
- **Estoque mínimo:** `minimo_tipo` `percent` (padrão 25% de `quantidade_referencia`, o nível após a última compra) ou `valor`; o banco recalcula `quantidade_minima`.
- **Gravação offline-safe:** registros, compras e movimentações passam por `src/lib/outbox.js` (insert/update/delete por id gerado no cliente, reenvio em ordem). `cronograma_atividades` **não tem** coluna `user_id`.
- `producaoModelo` por cultura (`planta` = kg/planta × plantas; `ha` = kg/ha × área). Culturas com `cronogramaGuiaCompleto` (ex.: maracujá) mantêm os dias do guia sem reescalonar.
- Tabelas legadas sem uso na UI atual: `plantio_eventos`, `diario_campo`, `aplicacoes_campo`, `receitas`.

## 6. Convenções de código
- JavaScript (sem TypeScript), React 19 + Vite 6 + Tailwind 4 (`@config` em `src/index.css` → `tailwind.config.js`), framer-motion, lucide-react, Leaflet, jsPDF, recharts. Comentários e textos de UI em português.
- Regras de negócio em **libs puras com testes** (`src/lib/*.js` + `*.test.js`, Vitest em ambiente node); componentes só orquestram.
- **Fontes únicas (não duplique):**
  - Registros, offline e fotos: `src/hooks/useAtividades.js`.
  - Compra = despesa + entrada no estoque: `registrarCompra` em `src/hooks/useDespesas.js`.
  - Fila offline: `src/lib/outbox.js`.
  - localStorage: `src/lib/safeStorage.js` (nunca chame `localStorage.setItem` direto).
  - Permissões: `src/lib/permissions.js`.
  - Guia e totais por lote: `src/lib/guia.js`.
  - Ciclo e fases do lote: `src/lib/lifecycle.js`.
  - Análise de solo e calagem: `src/lib/analiseSolo.js`.
  - Correspondência produto ↔ insumo: `matchEstoque` em `src/lib/listaCompras.js`.
  - Culturas: `src/data/culturas.js`.
- Abrir o "Anotar" de qualquer tela: `useAnotar().anotar({ loteId, editar, agendado, data, preenchido })` (`src/context/AnotarContext.jsx`). Novas funcionalidades entram no Anotar, no Início ou em Mais — não crie abas novas sem combinar.
- Armadilhas recorrentes:
  - `parseFloat(x) != null` deixa NaN passar — use `Number.isFinite`.
  - Datas "de hoje" no fuso local: `hojeLocalISO()`; nunca `toISOString()` para data.
  - Modal novo: `createPortal` + z-index acima da barra (z-50).
  - Effects que recarregam por id precisam de flag `cancel` no cleanup.
- Antes de commitar: `npm test` · `npm run lint` (zero `no-unused-vars`; há erros antigos de regras do React Compiler em arquivos legados) · `npm run build`. Com migration: o `pre-commit` roda `scripts/validate-migrations.js`; `npm run schema:check` compara código × banco.

## 7. Publicação
- **Web (PWA):**
  1. `npm run build`
  2. `git push`
  3. `vercel --prod` (o alias `oryagro.vercel.app` atualiza sozinho)
  4. Conferir no navegador: console sem erros e o hash do bundle novo.
- **Android (APK debug):**
  1. `npm run build`
  2. `npx cap sync android`
  3. No PowerShell: `Push-Location android; .\gradlew.bat assembleDebug --console=plain; Pop-Location`
  4. O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`, para instalar direto no aparelho. Não há assinatura de release nem loja.
  5. Toolchain: JDK 21, Android SDK em `%LOCALAPPDATA%\Android\Sdk`.
- **Banco:** aplicar a migration (MCP ou Management API com `SUPABASE_ACCESS_TOKEN`), verificar e versionar em `supabase/migrations/`.

## 8. Design
- Verde-floresta como cor primária (`--color-primary: hsl(156 64% 31%)`, `BRAND` nos componentes), fundo verde-acinzentado claro, cards brancos arredondados (`--radius: 1.15rem`), hero com gradiente escuro (`gradient-hero`). Fontes: Nunito (títulos) e Inter (texto). Cada cultura tem cor e emoji próprios (`cultura.cor`, `cultura.emoji`).
- **Mobile-first e poucos cliques.** Barra inferior: Início · Agenda · **[Anotar]** · Estoque · Mais. O lote tem 4 abas: Registros · Colheita · Finanças · Lote. Respeitar `env(safe-area-inset-*)` (APK com status bar sobreposta).
- Linguagem simples de produtor, em português do Brasil; números no formato pt-BR.

## Perguntas para o dono
1. O histórico remoto (`supabase_migrations.schema_migrations`) só tem 11 versões (até 20260525), e a migration da remodelação do cronograma (tabela `atividade_fotos`, bucket, colunas `categoria`/`data_prevista`) não tem arquivo em `supabase/migrations/`. Quer que eu gere o arquivo e alinhe o histórico?
2. As tabelas legadas (`plantio_eventos`, `diario_campo`, `aplicacoes_campo`, `receitas`) podem ser removidas?
3. Há textos desatualizados que posso corrigir:
   - `README.md` ainda é o modelo padrão do Vite.
   - O `.gitignore` diz "projeto agora é PWA, sem APK".
   - `.claude/agents/migration-deployer.md` cita React 18 e um `scripts/apply-migration.js` que não existe.
4. O APK vai continuar só em build debug, ou haverá assinatura/loja?
