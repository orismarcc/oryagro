/**
 * geo.js — utilitários geográficos para talhões (#7).
 *
 * Para áreas do tamanho de um talhão (dezenas a poucas centenas de metros),
 * uma projeção equiretangular local centrada no polígono é praticamente exata
 * (erro < 0,1%). Evita dependências pesadas e funciona offline.
 *
 * Convenção de coordenada: pontos são { lat, lng } em graus decimais.
 */

const R = 6_378_137; // raio equatorial da Terra (m) — WGS84
const rad = (d) => (d * Math.PI) / 180;

/** Distância entre dois pontos (metros), fórmula de Haversine. */
export function haversine(a, b) {
  if (!a || !b) return 0;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat), lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Centroide simples (média dos vértices). Suficiente para posicionar o mapa/clima. */
export function centroid(points) {
  const pts = (points || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length === 0) return null;
  const s = pts.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: s.lat / pts.length, lng: s.lng / pts.length };
}

/**
 * Área de um polígono (em hectares) a partir de vértices { lat, lng }.
 * Projeta cada ponto para metros numa equirretangular centrada no polígono e
 * aplica a fórmula do laço (shoelace). Retorna 0 para menos de 3 pontos.
 */
export function polygonAreaHa(points) {
  const pts = (points || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 3) return 0;
  const c = centroid(pts);
  const lat0 = rad(c.lat);
  // projeção local: x para leste, y para norte (metros)
  const xy = pts.map(p => ({
    x: rad(p.lng - c.lng) * R * Math.cos(lat0),
    y: rad(p.lat - c.lat) * R,
  }));
  let area2 = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const m2 = Math.abs(area2) / 2;
  return m2 / 10_000; // m² → ha
}

/** Perímetro do polígono (metros), fechando do último ao primeiro vértice. */
export function polygonPerimeter(points) {
  const pts = (points || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 2) return 0;
  let per = 0;
  for (let i = 0; i < pts.length; i++) per += haversine(pts[i], pts[(i + 1) % pts.length]);
  return per;
}

/** Converte [{lat,lng}] → geojson-like [[lng,lat],...] para persistir. */
export function pointsToGeojson(points) {
  return (points || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => [p.lng, p.lat]);
}

/** Converte geojson [[lng,lat],...] de volta para [{lat,lng}]. */
export function geojsonToPoints(geo) {
  if (!Array.isArray(geo)) return [];
  return geo
    .filter(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lng, lat]) => ({ lat, lng }));
}

/** Valida uma coordenada geográfica. */
export function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
