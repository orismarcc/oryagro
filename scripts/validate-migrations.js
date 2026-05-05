#!/usr/bin/env node
/**
 * OryAgro — Migration Validator
 * Validates staged Supabase migration files before git commit.
 *
 * Usado pelo hook PreToolUse (Claude Code) e pelo git pre-commit hook.
 *
 * Exit codes:
 *   0 — PASS (sem issues ou só warnings)
 *   1 — FAIL (issues críticos encontrados — commit bloqueado)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename, join } from 'path';

const ROOT    = resolve(process.cwd());
const MIG_DIR = join(ROOT, 'supabase', 'migrations');

// ── 1. Descobre arquivos de migração staged ───────────────────────────────────

function getStagedMigrations() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
    return out.trim().split('\n')
      .filter(f => f.startsWith('supabase/migrations/') && f.endsWith('.sql'));
  } catch {
    return [];
  }
}

// ── 2. Validators individuais ─────────────────────────────────────────────────

const VALIDATORS = [
  // ── CRÍTICOS ─────────────────────────────────────────────────────────────

  {
    name: 'CREATE POLICY IF NOT EXISTS',
    severity: 'critical',
    description: 'Sintaxe não suportada no PostgreSQL 15',
    check(sql) {
      const hits = (sql.match(/CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS/gi) || []);
      return hits.length
        ? [`${hits.length} ocorrência(s) de CREATE POLICY IF NOT EXISTS — não existe no PG15.\n     ✏️  Correção: DROP POLICY IF EXISTS "nome" ON tabela; CREATE POLICY "nome" ON tabela ...`]
        : [];
    },
  },

  {
    name: 'DROP TABLE sem IF EXISTS',
    severity: 'critical',
    description: 'DROP TABLE destrutivo sem guarda',
    check(sql) {
      const hits = (sql.match(/DROP\s+TABLE\s+(?!IF\s+EXISTS)[^\s;]+/gi) || []);
      return hits.map(h => `Comando destrutivo sem IF EXISTS: ${h.trim()}`);
    },
  },

  {
    name: 'DROP COLUMN sem IF EXISTS',
    severity: 'critical',
    description: 'DROP COLUMN destrutivo sem guarda',
    check(sql) {
      const hits = (sql.match(/DROP\s+COLUMN\s+(?!IF\s+EXISTS)[^\s,;]+/gi) || []);
      return hits.map(h => `Comando destrutivo sem IF EXISTS: ${h.trim()}`);
    },
  },

  {
    name: 'RLS habilitado em novas tabelas',
    severity: 'critical',
    description: 'Toda nova tabela precisa de RLS',
    check(sql) {
      const tables = [...sql.matchAll(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi
      )].map(m => m[1]);

      return tables
        .filter(t => {
          const re = new RegExp(
            `ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s+ON\\s+(?:public\\.)?${t}\\b`, 'i'
          );
          return !re.test(sql);
        })
        .map(t => `Tabela '${t}' criada sem ENABLE ROW LEVEL SECURITY\n     ✏️  Correção: ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    },
  },

  // ── WARNINGS ──────────────────────────────────────────────────────────────

  {
    name: 'user_id em novas tabelas',
    severity: 'warning',
    description: 'Tabelas sem user_id direto precisam de RLS por FK',
    check(sql) {
      const blocks = [...sql.matchAll(/CREATE\s+TABLE[^;]+;/gis)];
      return blocks.flatMap(([block]) => {
        const m = block.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/i);
        if (!m) return [];
        const name = m[1];
        const hasUserId  = /\buser_id\s+uuid\b/i.test(block);
        const hasOwnerFK = /REFERENCES\s+(?:public\.)?(?:plantios|propriedades|compradores|estoque_insumos)\b/i.test(block);
        if (!hasUserId && !hasOwnerFK) {
          return [`Tabela '${name}' sem user_id e sem FK de ownership — verifique escopo do RLS`];
        }
        return [];
      });
    },
  },

  {
    name: 'SECURITY DEFINER sem search_path',
    severity: 'warning',
    description: 'Funções SECURITY DEFINER devem fixar search_path',
    check(sql) {
      const funcs = [...sql.matchAll(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)[^$]*SECURITY\s+DEFINER/gis
      )];
      return funcs
        .filter(([block]) => !/SET\s+search_path\s*=\s*public/i.test(block))
        .map(([, name]) => `Função '${name}' usa SECURITY DEFINER sem 'SET search_path = public'`);
    },
  },

  {
    name: 'ALTER TABLE sem IF EXISTS na coluna',
    severity: 'warning',
    description: 'ADD COLUMN sem IF NOT EXISTS pode falhar se re-executada',
    check(sql) {
      const hits = (sql.match(/ALTER\s+TABLE[^;]*ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)[^\s,;(]+/gi) || []);
      return hits.map(h => `ADD COLUMN sem IF NOT EXISTS: ${h.trim().split('\n')[0]}`);
    },
  },
];

// ── 3. Nomes de arquivo duplicados (cross-file) ───────────────────────────────
// Só reporta se o NOME COMPLETO do arquivo aparecer duplicado — o projeto usa
// prefixo de data (20260429_xxx) com múltiplos arquivos por dia legitimamente.

function checkDuplicateTimestamps() {
  if (!existsSync(MIG_DIR)) return [];
  const files = readdirSync(MIG_DIR).filter(f => f.endsWith('.sql'));
  const seen  = new Set();
  const dupes = [];
  for (const f of files) {
    if (seen.has(f)) dupes.push(`Arquivo duplicado: ${f}`);
    else seen.add(f);
  }
  return dupes;
}

// ── 4. Score ──────────────────────────────────────────────────────────────────

function calcScore(issues) {
  let score = 100;
  for (const i of issues) {
    score -= i.severity === 'critical' ? 25 : 8;
  }
  return Math.max(0, score);
}

// ── 5. Main ───────────────────────────────────────────────────────────────────

function main() {
  const staged = getStagedMigrations();
  if (staged.length === 0) process.exit(0); // nada a validar

  const LINE = '─'.repeat(54);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║      OryAgro • Migration Validator v1.0              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n📋 ${staged.length} migration(s) staged para commit:\n`);

  const allIssues = [];

  for (const relPath of staged) {
    const file = basename(relPath);
    const full = resolve(ROOT, relPath);
    console.log(`  ▸ ${file}`);
    if (!existsSync(full)) continue;

    const sql = readFileSync(full, 'utf8');

    for (const v of VALIDATORS) {
      for (const msg of v.check(sql)) {
        allIssues.push({ file, severity: v.severity, name: v.name, message: msg });
        const icon = v.severity === 'critical' ? '  ❌' : '  ⚠️ ';
        console.log(`${icon} [${v.severity.toUpperCase()}] ${msg}`);
      }
    }
  }

  // Timestamps duplicados (global)
  for (const msg of checkDuplicateTimestamps()) {
    allIssues.push({ file: '(global)', severity: 'critical', name: 'Timestamp duplicado', message: msg });
    console.log(`  ❌ [CRITICAL] ${msg}`);
  }

  const criticals = allIssues.filter(i => i.severity === 'critical').length;
  const warnings  = allIssues.filter(i => i.severity === 'warning').length;
  const score     = calcScore(allIssues);

  console.log(`\n${LINE}`);
  const bar = '█'.repeat(Math.round(score / 5)) + '░'.repeat(20 - Math.round(score / 5));
  const color = score >= 80 ? '✅' : score >= 50 ? '⚠️ ' : '🚫';
  console.log(`${color} Deployment Readiness Score: ${score}/100  [${bar}]`);
  console.log(`   Críticos: ${criticals}   Warnings: ${warnings}`);
  console.log(LINE);

  if (criticals === 0 && warnings === 0) {
    console.log('\n✅ Todas as validações passaram — migration pronta para commit.\n');
    process.exit(0);
  } else if (criticals > 0) {
    console.log('\n🚫 COMMIT BLOQUEADO — corrija os erros críticos antes de commitar.\n');
    console.log('💡 Referência rápida de correções:');
    console.log('   • CREATE POLICY IF NOT EXISTS  →  DROP POLICY IF EXISTS "x" ON t; CREATE POLICY "x" ON t ...');
    console.log('   • DROP TABLE sem guarda        →  DROP TABLE IF EXISTS ...');
    console.log('   • Sem RLS                      →  ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;');
    console.log('   • ADD COLUMN sem guarda        →  ADD COLUMN IF NOT EXISTS ...\n');
    process.exit(1);
  } else {
    console.log('\n⚠️  Warnings encontrados — commit permitido, revise antes do deploy em produção.\n');
    process.exit(0);
  }
}

main();
