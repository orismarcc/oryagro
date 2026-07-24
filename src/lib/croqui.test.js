import { describe, it, expect } from 'vitest';
import { gerarCroqui, arestasDoPoligono } from './croqui';

// quadrado de ~ladoM metros centrado em (lat0,lng0)
function square(lat0, lng0, ladoM) {
  const dLat = ladoM / 111320;
  const dLng = ladoM / (111320 * Math.cos(lat0 * Math.PI / 180));
  return [
    { lat: lat0, lng: lng0 },
    { lat: lat0, lng: lng0 + dLng },
    { lat: lat0 + dLat, lng: lng0 + dLng },
    { lat: lat0 + dLat, lng: lng0 },
  ];
}

describe('gerarCroqui', () => {
  const lat = -10.62, lng = -51.56;

  it('quadrado de 40 m a 4×4 → ~100 covas', () => {
    const r = gerarCroqui({ pontos: square(lat, lng, 40), dx: 4, dy: 4 });
    // grade 4m num quadrado de 40m: ~11×11 = 121 no limite; centralizada ~100-121
    expect(r.covas.length).toBeGreaterThan(90);
    expect(r.covas.length).toBeLessThanOrEqual(121);
    expect(r.area).toBeGreaterThan(0.15);
  });

  it('recuo de cerca reduz o número de covas', () => {
    const p = square(lat, lng, 40);
    const semCerca = gerarCroqui({ pontos: p, dx: 4, dy: 4 });
    const comCerca = gerarCroqui({ pontos: p, dx: 4, dy: 4, cercaIdx: [0, 2], recuoM: 3 });
    expect(comCerca.covas.length).toBeLessThan(semCerca.covas.length);
  });

  it('consórcio adiciona covas nas entrelinhas', () => {
    const r = gerarCroqui({ pontos: square(lat, lng, 40), dx: 4, dy: 4, consorcio: { dx: 2.5 } });
    expect(r.consorcio.length).toBeGreaterThan(0);
    // com 2,5 m na linha, o consórcio tem MAIS covas por linha que o principal (4 m)
    expect(r.consorcio.length).toBeGreaterThan(r.covas.length * 0.6);
  });

  it('espaçamento maior → menos covas', () => {
    const p = square(lat, lng, 40);
    const denso = gerarCroqui({ pontos: p, dx: 3, dy: 3 });
    const ralo = gerarCroqui({ pontos: p, dx: 5, dy: 5 });
    expect(ralo.covas.length).toBeLessThan(denso.covas.length);
  });

  it('polígono inválido retorna vazio', () => {
    expect(gerarCroqui({ pontos: [{ lat, lng }], dx: 4, dy: 4 }).covas).toEqual([]);
    expect(gerarCroqui({ pontos: square(lat, lng, 40), dx: 0, dy: 4 }).covas).toEqual([]);
  });

  it('arestasDoPoligono retorna comprimentos coerentes', () => {
    const { poligonoXY } = gerarCroqui({ pontos: square(lat, lng, 40), dx: 4, dy: 4 });
    const ar = arestasDoPoligono(poligonoXY);
    expect(ar.length).toBe(4);
    ar.forEach(e => { expect(e.len).toBeGreaterThan(38); expect(e.len).toBeLessThan(42); });
  });
});
