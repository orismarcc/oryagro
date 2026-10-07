import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Fila offline: o que é anotado sem sinal precisa (1) ficar guardado, (2) subir
 * na ordem certa e (3) nunca duplicar. Simulamos localStorage, window e o
 * Supabase (que primeiro "não tem rede" e depois volta).
 */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {} };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };

let online = false;
const banco = {};              // tabela → { id → linha }
const chamadas = [];
const semRede = { message: 'Failed to fetch' };

function query(table) {
  const t = (banco[table] = banco[table] || {});
  return {
    insert(row) {
      chamadas.push(['insert', table, row.id]);
      const res = !online ? { data: null, error: semRede }
        : t[row.id] ? { data: null, error: { code: '23505' } }
        : (t[row.id] = { ...row }, { data: t[row.id], error: null });
      return { select: () => ({ single: async () => res }), then: (ok) => ok(res) };
    },
    update(patch) {
      return {
        eq: (_c, id) => {
          chamadas.push(['update', table, id]);
          const res = !online ? { data: null, error: semRede }
            : (t[id] && Object.assign(t[id], patch), { data: t[id] || null, error: null });
          return { select: () => ({ single: async () => res }), then: (ok) => ok(res) };
        },
      };
    },
    delete() {
      return {
        eq: async (_c, id) => {
          chamadas.push(['delete', table, id]);
          if (!online) return { error: semRede };
          delete t[id];
          return { error: null };
        },
      };
    },
  };
}
vi.mock('./supabase', () => ({ supabase: { from: (t) => query(t) } }));
vi.mock('./logger', () => ({ logWarn: () => {} }));

const { insertOfflineSafe, updateOfflineSafe, deleteOfflineSafe, pendentes, pendingCount, initOutbox } = await import('./outbox');

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(banco)) delete banco[k];
  chamadas.length = 0;
  online = false;
});

describe('fila offline', () => {
  it('sem sinal: guarda o insert e devolve a linha otimista', async () => {
    const r = await insertOfflineSafe('cronograma_atividades', { plantio_id: 'L1', etapa: 'Sulfato', status: 'feito' });
    expect(r.queued).toBe(true);
    expect(r.row.id).toBeTruthy();
    expect(pendingCount()).toBe(1);
    expect(pendentes('cronograma_atividades')[0]).toMatchObject({ etapa: 'Sulfato', _pendente: true });
  });

  it('edição offline de um registro pendente aparece já aplicada; exclusão o tira da lista', async () => {
    const { row } = await insertOfflineSafe('cronograma_atividades', { etapa: 'A', status: 'agendado' });
    await updateOfflineSafe('cronograma_atividades', row.id, { status: 'feito' });
    await updateOfflineSafe('cronograma_atividades', row.id, { observacao: 'ok' });
    expect(pendingCount()).toBe(2); // 1 insert + 1 update (os dois updates se fundem)
    expect(pendentes('cronograma_atividades')[0]).toMatchObject({ status: 'feito', observacao: 'ok' });
    await deleteOfflineSafe('cronograma_atividades', row.id);
    expect(pendentes('cronograma_atividades')).toHaveLength(0);
  });

  it('quando a rede volta, sobe na ordem (insert antes do update) e esvazia', async () => {
    const { row } = await insertOfflineSafe('cronograma_atividades', { etapa: 'A', status: 'agendado' });
    await updateOfflineSafe('cronograma_atividades', row.id, { status: 'feito' });
    online = true;
    chamadas.length = 0;
    initOutbox();                       // dispara o primeiro envio
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    expect(chamadas.map(c => c[0])).toEqual(['insert', 'update']);
    expect(banco.cronograma_atividades[row.id].status).toBe('feito');
    expect(pendingCount()).toBe(0);
  });
});
