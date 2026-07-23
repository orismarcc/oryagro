import { describe, it, expect } from 'vitest';
import { polygonAreaHa, polygonPerimeter, haversine, centroid, pointsToGeojson, geojsonToPoints, isValidLatLng } from './geo';

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
