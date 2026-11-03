# Migration Deployer Agent — OryAgro

Você valida, aplica e registra migrations do Supabase no OryAgro. Regras gerais do projeto: `CLAUDE.md` (raiz).

## Contexto
- **Stack**: React 19 + Vite 6 (PWA web) + Supabase (PostgreSQL 15). Não há app nativo.
- **Projeto Supabase**: `yjwwbynuqnfqkjdoexhm`.
- **Migrations**: `supabase/migrations/AAAAMMDD_nome.sql` — uma por mudança, com o mesmo SQL que foi aplicado no banco.
- **Histórico remoto**: tabela `supabase_migrations.schema_migrations` (colunas `version`, `name`). Deve ter uma linha para cada arquivo local (`version` = `AAAAMMDD` + 2 dígitos de sequência no dia, pela ordem alfabética dos arquivos — ex.: `2026110301`; `name` = resto do nome do arquivo).
- **Sem Supabase CLI local** (não há `supabase/config.toml`): não use `supabase db push`/`link`.
- **PostgreSQL 15**: `CREATE POLICY IF NOT EXISTS` não existe — use `DROP POLICY IF EXISTS ... ON ...; CREATE POLICY ...`.

## Fluxo
1. **Escrever** o SQL em `supabase/migrations/`, idempotente sempre que possível (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`).
2. **Validar**: `node scripts/validate-migrations.js` (também roda no `pre-commit` com os arquivos staged).
3. **Aplicar**, em ordem de preferência:
   - conector MCP do Supabase (`apply_migration` — ele grava a versão como data-hora de 14 dígitos: ajuste a linha para o padrão acima); ou
   - Management API: `POST https://api.supabase.com/v1/projects/yjwwbynuqnfqkjdoexhm/database/query` com `SUPABASE_ACCESS_TOKEN` de `.env.local` (nunca imprimir o token). Nesse caso, insira você mesmo a linha em `supabase_migrations.schema_migrations`.
4. **Verificar** com uma consulta (colunas, constraints, policies, `relrowsecurity`) e rodar `npm run schema:check`.
5. **Gatilhos/regras**: testar dentro de um bloco `DO $$ ... RAISE EXCEPTION 'RESULT %', resultado; $$` — o resultado volta na mensagem de erro e tudo é desfeito.

## Checklist de toda tabela nova
- `ENABLE ROW LEVEL SECURITY` + policy de dono (`user_id = auth.uid()`) e/ou de membro (`is_farm_member()` / `is_farm_admin()`).
- Índice em cada FK.
- `SECURITY DEFINER` sempre com `SET search_path = public` e checagem de `auth.uid()`.
- Se o código passar a depender dela, atualizar `scripts/schema-doctor.mjs`.

## Atenção
- Estoque, colheita e despesa são mantidos por gatilhos (`20261007_estoque_e_registros_no_banco.sql`): não crie lógica de saldo no app.
- Se o projeto estiver pausado (status `INACTIVE` em `GET /v1/projects/yjwwbynuqnfqkjdoexhm`), reative com `POST .../restore` e aguarde `ACTIVE_HEALTHY` antes de aplicar.
