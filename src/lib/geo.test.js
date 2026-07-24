import { describe, it, expect } from 'vitest';
import { polygonAreaHa, polygonPerimeter, haversine, centroid, pointsToGeojson, geojsonToPoints, isValidLatLng, simplifyRDP } from './geo';

// desloca um ponto por (dx metros leste, dy metros norte)
function offset(lat, lng, dx, dy) {
  return { lat: lat + (dy / 111320), lng: lng + (dx / (111320 * Math.cos(lat * Math.PI / 180))) };
}

describe('simplifyRDP (linha reta → mantém só X e Y)', () => {
  const lat = -10.62, lng = -51.56;
  it('colapsa uma reta com ruído < tolerância em 2 pontos', () => {
    // reta de 0 a 80 m no eixo leste, com pontos a cada 4 m e ruído ±1 m
    const pts = [];
    for (let d = 0; d <= 80; d += 4) pts.push(offset(lat, lng, d, (d % 8 === 0 ? 0.8 : -0.8)));
    const s = simplifyRDP(pts, 3);
    expect(s.length).toBe(2); // só início e fim
  });
  it('preserva um canto real (L de 90°)', () => {
    const pts = [];
    for (let d = 0; d <= 40; d += 4) pts.push(offset(lat, lng, d, 0));      // lado leste
    for (let d = 4; d <= 40; d += 4) pts.push(offset(lat, lng, 40, d));     // vira ao norte
    const s = simplifyRDP(pts, 3);
    expect(s.length).toBe(3); // início, canto, fim
  });
  it('mantém pontos que desviam mais que a tolerância', () => {
    const pts = [offset(lat, lng, 0, 0), offset(lat, lng, 20, 10), offset(lat, lng, 40, 0)];
    expect(simplifyRDP(pts, 3).length).toBe(3); // desvio de 10 m > 3 m
  });
  it('fecha o laço: remove o último se coincide com o primeiro', () => {
    const quad = [offset(lat, lng, 0, 0), offset(lat, lng, 40, 0), offset(lat, lng, 40, 40), offset(lat, lng, 0, 40), offset(lat, lng, 0.5, 0.5)];
    const s = simplifyRDP(quad, 3);
    expect(s.length).toBe(4); // 4 cantos, sem o ponto de fechamento
  });
  it('não altera trajetos com 2 ou menos pontos', () => {
    expect(simplifyRDP([offset(lat, lng, 0, 0)], 3).length).toBe(1);
  });
});

// Constrói um quadrado de ~ladoM metros centrado em (lat0, lng0)
function square(lat0, lng0, ladoM) {
  const dLat = (ladoM / 2) / 111_320;                      // graus por metro (lat)
  const dLng = (ladoM / 2) / (111_320 * Math.cos(lat0 * Math.PI / 180));
  return [
    { lat: lat0 - dLat, lng: lng0 - dLng },
    { lat: lat0 - dLat, lng: lng0 + dLng },
    { lat: lat0 + dLat, lng: lng0 + dLng },
    { lat: lat0 + dLat, lng: lng0 - dLng },
  ];
}

describe('polygonAreaHa', () => {
  it('quadrado de 100 m ≈ 1 ha', () => {
    const a = polygonAreaHa(square(-15, -47, 100)); // Brasília aprox.
    expect(a).toBeGreaterThan(0.99);
    expect(a).toBeLessThan(1.01);
  });
  it('quadrado de 200 m ≈ 4 ha', () => {
    const a = polygonAreaHa(square(-5, -40, 200));
    expect(a).toBeGreaterThan(3.96);
    expect(a).toBeLessThan(4.04);
  });
  it('funciona longe do equador (lat -30)', () => {
    const a = polygonAreaHa(square(-30, -51, 100));
    expect(a).toBeGreaterThan(0.98);
    expect(a).toBeLessThan(1.02);
  });
  it('retorna 0 com menos de 3 vértices', () => {
    expect(polygonAreaHa([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(0);
    expect(polygonAreaHa([])).toBe(0);
    expect(polygonAreaHa(null)).toBe(0);
  });
});

describe('polygonPerimeter', () => {
  it('perímetro do quadrado de 100 m ≈ 400 m', () => {
    const p = polygonPerimeter(square(-15, -47, 100));
    expect(p).toBeGreaterThan(398);
    expect(p).toBeLessThan(402);
  });
});

describe('haversine', () => {
  it('mede ~100 m entre pontos separados por ~100 m', () => {
    const d = haversine({ lat: -15, lng: -47 }, { lat: -15, lng: -47 + 100 / (111_320 * Math.cos(-15 * Math.PI / 180)) });
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });
});

describe('centroid e conversões', () => {
  it('centroide do quadrado é o centro', () => {
    const c = centroid(square(-15, -47, 100));
    expect(c.lat).toBeCloseTo(-15, 4);
    expect(c.lng).toBeCloseTo(-47, 4);
  });
  it('round-trip pontos ↔ geojson', () => {
    const pts = [{ lat: -15, lng: -47 }, { lat: -15.001, lng: -47.001 }];
    const geo = pointsToGeojson(pts);
    expect(geo).toEqual([[-47, -15], [-47.001, -15.001]]);
    expect(geojsonToPoints(geo)).toEqual(pts);
  });
  it('geojsonToPoints ignora entradas inválidas', () => {
    expect(geojsonToPoints([[1, 2], 'x', [null, 3], [4]])).toEqual([{ lat: 2, lng: 1 }]);
  });
});

describe('isValidLatLng', () => {
  it('aceita coordenadas válidas e rejeita inválidas', () => {
    expect(isValidLatLng(-15, -47)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 200)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
  });
});
