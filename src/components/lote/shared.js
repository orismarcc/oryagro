// ─── Shared helpers for lote tab components ─────────────────────────────────

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDatePtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtNumber(n) {
  return n?.toLocaleString('pt-BR') ?? '—';
}

export function fmtBRL(n) {
  if (n === undefined || n === null || isNaN(n)) return 'R$ —';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function safeLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function calcScale(cultura, lote) {
  if (cultura.tipo === 'campo') {
    const base = cultura.area?.padrao || 1;
    return (parseFloat(lote.area_ha) || 1) / base;
  }
  const base = cultura.canteiro.comprimento * cultura.canteiro.largura;
  const actual =
    (parseFloat(lote.comprimento_m) || cultura.canteiro.comprimento) *
    (parseFloat(lote.largura_m) || cultura.canteiro.largura);
  return actual / base;
}
