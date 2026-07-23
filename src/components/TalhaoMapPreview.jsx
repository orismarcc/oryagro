/**
 * TalhaoMapPreview.jsx — recorte read-only da área demarcada do talhão.
 *
 * Mini-mapa de satélite não interativo, ajustado ao polígono, mais as métricas
 * (hectares, perímetro, vértices) — o mesmo resumo mostrado no editor, agora
 * visível direto no card do talhão sem precisar abrir "Editar".
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { polygonAreaHa, polygonPerimeter, geojsonToPoints } from '../lib/geo';
import { getFonte } from '../data/mapTiles';

export default function TalhaoMapPreview({ geojson, areaHa, height = 150, cor = '#16a34a' }) {
  const pontos = geojsonToPoints(geojson);
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  const area = areaHa != null ? Number(areaHa) : polygonAreaHa(pontos);
  const perimetro = polygonPerimeter(pontos);

  useEffect(() => {
    if (pontos.length < 3 || !divRef.current || mapRef.current) return;
    const el = divRef.current;

    // Mapa puramente ilustrativo: todas as interações desligadas
    const map = L.map(el, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false, tap: false,
    });

    const fonte = getFonte('esri');
    L.tileLayer(fonte.url, { maxZoom: fonte.maxZoom }).addTo(map);

    const latlngs = pontos.map(p => [p.lat, p.lng]);
    const poly = L.polygon(latlngs, { color: cor, weight: 2.5, fillColor: cor, fillOpacity: 0.28 }).addTo(map);
    map.fitBounds(poly.getBounds(), { padding: [16, 16], maxZoom: 18 });

    const fix = () => { try { map.invalidateSize(); map.fitBounds(poly.getBounds(), { padding: [16, 16], maxZoom: 18 }); } catch { /* ok */ } };
    requestAnimationFrame(fix);
    const t = setTimeout(fix, 250);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null;
    ro?.observe(el);

    mapRef.current = map;
    setReady(true);

    return () => {
      clearTimeout(t); ro?.disconnect();
      try { map.remove(); } catch { /* ok */ }
      mapRef.current = null; setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  if (pontos.length < 3) return null;

  return (
    <div className="mt-3">
      <div
        ref={divRef}
        style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(152 14% 84%)', background: '#dddddd' }}
      />
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
          <p className="text-[15px] font-black leading-none" style={{ color: cor }}>
            {area.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </p>
          <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">hectares</p>
        </div>
        <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
          <p className="text-[15px] font-black leading-none" style={{ color: cor }}>{Math.round(perimetro)}</p>
          <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">m perímetro</p>
        </div>
        <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
          <p className="text-[15px] font-black leading-none" style={{ color: cor }}>{pontos.length}</p>
          <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">vértices</p>
        </div>
      </div>
    </div>
  );
}
