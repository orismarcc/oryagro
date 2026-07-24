/**
 * croqui.js — motor do croqui de plantio (grade de covas dentro do polígono).
 *
 * 100% geometria determinística (SEM IA): grade regular alinhada a um lado do
 * talhão, teste ponto-dentro-do-polígono, recuo de cerca por aresta e, opcional,
 * um cultivo consorciado nas entrelinhas. Reaproveita a projeção equiretangular
 * local (mesma de lib/geo) — preciso para áreas do tamanho de um talhão.
 */
const R = 6_378_137;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function projetar(points) {
  const c = { lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
              lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
  const kx = R * Math.cos(rad(c.lat)), ky = R;
  const xy = points.map(p => ({ x: rad(p.lng - c.lng) * kx, y: rad(p.lat - c.lat) * ky }));
  const toLL = (x, y) => ({ lat: c.lat + deg(y / ky), lng: c.lng + deg(x / kx) });
  return { xy, toLL, center: c };
}

function insidePoly(V, x, y) {
  let ins = false;
  for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    const xi = V[i].x, yi = V[i].y, xj = V[j].x, yj = V[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function distSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Arestas do polígono com comprimento e azimute (0–180°). */
export function arestasDoPoligono(geojsonPoints) {
  const V = geojsonPoints;
  return V.map((p, i) => {
    const q = V[(i + 1) % V.length];
    const dx = q.x - p.x, dy = q.y - p.y;
    let az = (deg(Math.atan2(dx, dy)) + 360) % 360;
    if (az >= 180) az -= 180;
    return { i, len: Math.hypot(dx, dy), az };
  });
}

/**
 * Gera a grade de covas.
 * @param {Object} p
 * @param {Array<{lat,lng}>} p.pontos    - vértices do polígono
 * @param {number} p.dx                  - espaçamento entre plantas na linha (m)
 * @param {number} p.dy                  - espaçamento entre linhas (m)
 * @param {number[]} p.cercaIdx          - índices das arestas com cerca
 * @param {number} p.recuoM              - recuo mínimo das cercas (m)
 * @param {number|null} p.linhaArestaIdx - aresta cuja direção as linhas seguem
 *                                         (null = maior aresta)
 * @param {{dx:number}|null} p.consorcio - cultivo nas entrelinhas (espaç. na linha)
 * @returns {{ area, center, poligonoXY, arestas, covas, consorcio, direcaoAz }}
 */
export function gerarCroqui({ pontos, dx = 4, dy = 4, cercaIdx = [], recuoM = 0, linhaArestaIdx = null, consorcio = null }) {
  const pts = (pontos || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 3 || !(dx > 0) || !(dy > 0)) {
    return { area: 0, poligonoXY: [], arestas: [], covas: [], consorcio: [], center: null, direcaoAz: 0 };
  }
  const { xy: V, toLL, center } = projetar(pts);
  const arestas = arestasDoPoligono(V);
  const fences = cercaIdx.map(i => [V[i], V[(i + 1) % V.length]]).filter(f => f[0] && f[1]);

  // direção das linhas = aresta escolhida (ou a maior)
  const baseIdx = linhaArestaIdx != null && arestas[linhaArestaIdx]
    ? linhaArestaIdx
    : arestas.reduce((mx, e) => (e.len > arestas[mx].len ? e.i : mx), 0);
  const A = V[baseIdx], B = V[(baseIdx + 1) % V.length];
  const uLen = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const u = { x: (B.x - A.x) / uLen, y: (B.y - A.y) / uLen };  // ao longo da linha
  const v = { x: u.y, y: -u.x };                               // entre linhas

  const ok = (x, y) => insidePoly(V, x, y) && fences.every(f => distSeg(x, y, f[0], f[1]) >= recuoM);
  const proj = V.map(p => ({ a: p.x * u.x + p.y * u.y, b: p.x * v.x + p.y * v.y }));
  const amin = Math.min(...proj.map(p => p.a)), amax = Math.max(...proj.map(p => p.a));
  const bmin = Math.min(...proj.map(p => p.b)), bmax = Math.max(...proj.map(p => p.b));
  const toXY = (a, b) => ({ x: a * u.x + b * v.x, y: a * u.y + b * v.y });
  const centro = (min, max, step) => { const n = Math.floor((max - min) / step); return { n, off: min + ((max - min) - n * step) / 2 }; };

  const rows = centro(bmin, bmax, dy);
  const along = centro(amin, amax, dx);
  const covas = [];
  for (let k = 0; k <= rows.n; k++) {
    const b = rows.off + k * dy;
    for (let m = 0; m <= along.n; m++) {
      const a = along.off + m * dx;
      const P = toXY(a, b);
      if (ok(P.x, P.y)) { const ll = toLL(P.x, P.y); covas.push({ x: P.x, y: P.y, lat: ll.lat, lng: ll.lng, lin: k }); }
    }
  }

  // Consórcio: uma linha no meio de cada entrelinha, com espaçamento próprio
  const consorcioCovas = [];
  if (consorcio && consorcio.dx > 0) {
    const alongC = centro(amin, amax, consorcio.dx);
    for (let k = 0; k < rows.n; k++) {
      const b = rows.off + k * dy + dy / 2;
      for (let m = 0; m <= alongC.n; m++) {
        const a = alongC.off + m * consorcio.dx;
        const P = toXY(a, b);
        if (ok(P.x, P.y)) { const ll = toLL(P.x, P.y); consorcioCovas.push({ x: P.x, y: P.y, lat: ll.lat, lng: ll.lng, lin: k }); }
      }
    }
  }

  // área do polígono
  let a2 = 0;
  for (let i = 0; i < V.length; i++) { const p = V[i], q = V[(i + 1) % V.length]; a2 += p.x * q.y - q.x * p.y; }
  const area = Math.abs(a2) / 2 / 10000;

  const dirAz = (deg(Math.atan2(u.x, u.y)) + 360) % 360;
  return {
    area: Math.round(area * 10000) / 10000,
    center, poligonoXY: V, arestas, covas, consorcio: consorcioCovas,
    direcaoAz: Math.round(dirAz % 180 * 10) / 10,
  };
}
