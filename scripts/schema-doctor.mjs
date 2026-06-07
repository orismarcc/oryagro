#!/usr/bin/env node
/**
 * schema-doctor.mjs — valida que o banco em produção tem a estrutura que o
 * código espera (tabelas, colunas, RPCs, constraints de status e RLS).
 *
 * Foi este tipo de divergência código↔DB que causou os bugs de:
 *   • despesas não salvando (tabela audit_log faltando)
 *   • exclusão de etapa não persistindo ('removida' faltando no CHECK)
 *   • concluir lote falhando ('concluido' faltando no CHECK)
 *
 * Uso:  npm run schema:check
 * Lê SUPABASE_ACCESS_TOKEN de .env.local e o project-ref de supabase/.temp.
 * Sai com código !=0 se houver qualquer divergência (pronto para CI).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Credenciais ────────────────────────────────────────────────────────────────
function readEnvLocal() {
  const txt = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = readEnvLocal();
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();

if (!TOKEN || !REF) {
  console.error('✗ Faltam SUPABASE_ACCESS_TOKEN (.env.local) ou project-ref (supabase/.temp).');
  process.exit(2);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(json.message || 'query falhou');
  return json;
}

// ── Expectativas (o que o código assume existir) ──────────────────────────────
const EXPECT = {
  tables: [
    'plantios', 'talhoes', 'despesas', 'receitas', 'vendas', 'venda_parcelas',
    'estoque_insumos', 'estoque_movimentos', 'cronograma_atividades', 'audit_log',
    'propriedades', 'farm_members', 'plantio_eventos', 'ciclos_historico',
    'compradores', 'diario_campo', 'mao_obra_registros', 'simulador_configs',
    'curvas_producao', 'producao_registros', 'profiles',
    'whatsapp_config', 'whatsapp_notificacoes',
  ],
  rpcs: ['adjust_insumo_quantidade', 'delete_movimento_with_balance', 'lookup_user_by_email'],
  columns: {
    despesas: ['quantidade', 'unidade'],
    plantios: ['talhao_id', 'tipo_cultura', 'safra_numero'],
    estoque_movimentos: ['despesa_id', 'cronograma_atividade_id', 'preco_unitario_movimento'],
    cronograma_atividades: ['is_custom', 'data_execucao'],
    talhoes: ['espacamento_linhas', 'espacamento_plantas'],
  },
  // constraint → substring que precisa conter
  checkContains: {
    cronograma_atividades_status_check: 'removida',
    plantios_status_check: 'concluido',
  },
};

const problems = [];
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); problems.push(m); };

async function main() {
  console.log('\n🩺 OryAgro • Schema Doctor\n');

  // 1. Tabelas
  console.log('Tabelas:');
  const tbl = await query(
    `select t as nome, to_regclass('public.'||t) is not null as existe
     from unnest(array[${EXPECT.tables.map(t => `'${t}'`).join(',')}]) t`
  );
  for (const r of tbl) r.existe ? ok(r.nome) : fail(`tabela ausente: ${r.nome}`);

  // 2. RPCs
  console.log('\nRPCs:');
  const rpc = await query(
    `select f as nome, exists(select 1 from pg_proc where proname=f) as existe
     from unnest(array[${EXPECT.rpcs.map(f => `'${f}'`).join(',')}]) f`
  );
  for (const r of rpc) r.existe ? ok(r.nome) : fail(`RPC ausente: ${r.nome}`);

  // 3. Colunas
  console.log('\nColunas críticas:');
  for (const [table, cols] of Object.entries(EXPECT.columns)) {
    const got = await query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='${table}'`
    );
    const set = new Set(got.map(r => r.column_name));
    for (const c of cols) set.has(c) ? ok(`${table}.${c}`) : fail(`coluna ausente: ${table}.${c}`);
  }

  // 4. CHECK constraints contêm os valores esperados
  console.log('\nCHECK constraints de status:');
  for (const [conname, needle] of Object.entries(EXPECT.checkContains)) {
    const got = await query(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname='${conname}'`
    );
    const def = got[0]?.def || '';
    def.includes(needle)
      ? ok(`${conname} contém '${needle}'`)
      : fail(`${conname} NÃO contém '${needle}' (def: ${def || 'constraint ausente'})`);
  }

  // 5. RLS em todas as tabelas esperadas
  console.log('\nRLS (Row Level Security):');
  const rls = await query(
    `select c.relname as nome, c.relrowsecurity as on
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r'
       and c.relname = any(array[${EXPECT.tables.map(t => `'${t}'`).join(',')}])`
  );
  for (const r of rls) r.on ? ok(`${r.nome} (RLS on)`) : fail(`RLS DESLIGADO: ${r.nome}`);

  // ── Resultado ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(54));
  if (problems.length === 0) {
    console.log('\x1b[32m✅ Schema em dia — código e banco alinhados.\x1b[0m\n');
    process.exit(0);
  } else {
    console.log(`\x1b[31m❌ ${problems.length} divergência(s) encontrada(s):\x1b[0m`);
    for (const p of problems) console.log(`   • ${p}`);
    console.log('');
    process.exit(1);
  }
}

main().catch(err => { console.error('\nErro ao validar schema:', err.message); process.exit(2); });
