/**
 * TalhaoMapEditor.jsx — define a geometria/localização de um talhão (#7).
 *
 * Três formas, todas funcionais:
 *   1. Mapa   — desenhar o polígono tocando no mapa; várias fontes de satélite
 *              selecionáveis (a cobertura varia por região — ver data/mapTiles).
 *   2. Caminhar — andar a borda do talhão; o GPS grava os vértices (offline).
 *   3. Ponto  — marcar só a coordenada central (GPS atual ou digitada).
 *
 * Área calculada localmente (lib/geo, projeção equiretangular) — confiável
 * mesmo sem os tiles do mapa.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { X, MapPin, Footprints, Crosshair, Undo2, Trash2, Check, Loader2, Map as MapIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  polygonAreaHa, polygonPerimeter, centroid, pointsToGeojson, geojsonToPoints, isValidLatLng, haversine,
} from '../lib/geo';
import { updateTalhaoGeo } from '../hooks/useSupabaseSync';
import { FONTES_MAPA, FONTE_PADRAO, getFonte } from '../data/mapTiles';

const MODOS = [
  { id: 'mapa', label: 'Mapa', Icon: MapIcon },
  { id: 'caminhar', label: 'Caminhar', Icon: Footprints },
  { id: 'ponto', label: 'Ponto', Icon: Crosshair },
];

export default function TalhaoMapEditor({ talhao, onClose, onSaved }) {
  const toast = useToast();
  const [modo, setModo] = useState('mapa');
  const [pontos, setPontos] = useState(() => geojsonToPoints(talhao?.geojson));
  const [salvando, setSalvando] = useState(false);

  // ponto central manual
  const [latManual, setLatManual] = useState(talhao?.latitude != null ? String(talhao.latitude) : '');
  const [lngManual, setLngManual] = useState(talhao?.longitude != null ? String(talhao.longitude) : '');

  // caminhar
  const [watching, setWatching] = useState(false);
  const [gpsAcc, setGpsAcc] = useState(null);
  const watchIdRef = useRef(null);

  const area = polygonAreaHa(pontos);
  const perimetro = polygonPerimeter(pontos);

  // ── Leaflet (modo mapa) ────────────────────────────────────────────────
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const [fonteId, setFonteId] = useState(FONTE_PADRAO);
  const [ready, setReady] = useState(false);

  const redraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    const grp = L.layerGroup();
    if (pontos.length >= 3) {
      L.polygon(pontos.map(p => [p.lat, p.lng]), { color: '#16a34a', weight: 2, fillOpacity: 0.25 }).addTo(grp);
    } else if (pontos.length >= 2) {
      L.polyline(pontos.map(p => [p.lat, p.lng]), { color: '#16a34a', weight: 2, dashArray: '4' }).addTo(grp);
    }
    pontos.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: '#0f5132', fillColor: '#22c55e', fillOpacity: 1, weight: 2 })
        .bindTooltip(String(i + 1), { permanent: false }).addTo(grp);
    });
    grp.addTo(map);
    layerRef.current = grp;
  }, [pontos]);

  useEffect(() => {
    if (modo !== 'mapa' || !mapDivRef.current || mapRef.current) return;
    const el = mapDivRef.current;
    const start = pontos.length ? centroid(pontos)
      : (isValidLatLng(talhao?.latitude, talhao?.longitude) ? { lat: talhao.latitude, lng: talhao.longitude }
      : { lat: -14.24, lng: -51.93 }); // centro do Brasil (fallback)

    // Ícone padrão do Leaflet quebra sob bundler — removemos a resolução automática
    delete L.Icon.Default.prototype._getIconUrl;

    const map = L.map(el, { zoomControl: true, attributionControl: true });
    map.setView([start.lat, start.lng], pontos.length ? 17 : 5);

    const fonte = getFonte(fonteId);
    const tile = L.tileLayer(fonte.url, { maxZoom: fonte.maxZoom, attribution: fonte.attribution });
    tile.addTo(map);
    tileRef.current = tile;

    map.getContainer().style.cursor = 'crosshair';
    map.on('click', (e) => {
      setPontos(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    });

    mapRef.current = map;

    // O mapa nasce dentro de um modal com animação: o container pode ter altura 0
    // no momento da criação, o que deixa o mapa em branco. Recalculamos o tamanho
    // logo, de novo após a animação, e sempre que o container mudar de tamanho.
    const fix = () => { try { map.invalidateSize(); } catch { /* ok */ } };
    requestAnimationFrame(fix);
    const t1 = setTimeout(fix, 150);
    const t2 = setTimeout(fix, 400);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null;
    ro?.observe(el);

    setReady(true);
    redraw();

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      ro?.disconnect();
      try { map.remove(); } catch { /* ok */ }
      mapRef.current = null; layerRef.current = null; tileRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  // Troca de fonte de imagem sem recriar o mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (tileRef.current) { try { tileRef.current.remove(); } catch { /* ok */ } }
    const fonte = getFonte(fonteId);
    const tile = L.tileLayer(fonte.url, { maxZoom: fonte.maxZoom, attribution: fonte.attribution });
    tile.addTo(map);
    tileRef.current = tile;
  }, [fonteId, ready]);

  useEffect(() => { if (modo === 'mapa') redraw(); }, [pontos, modo, redraw]);

  const localizarNoMapa = () => {
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) mapRef.current.setView([latitude, longitude], 18);
      },
      () => toast.error('Não foi possível obter a localização.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── Caminhar (GPS) ───────────────────────────────────────────────────────
  const toggleWalk = () => {
    if (watching) {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
      return;
    }
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    setWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAcc(Math.round(accuracy));
        setPontos(prev => {
          const last = prev[prev.length - 1];
          // filtra ruído: só grava se andou > 4 m desde o último vértice
          if (last && haversine(last, { lat: latitude, lng: longitude }) < 4) return prev;
          return [...prev, { lat: latitude, lng: longitude }];
        });
      },
      () => { toast.error('Falha no GPS. Verifique a permissão de localização.'); setWatching(false); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  };

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  const usarGpsPonto = () => {
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatManual(pos.coords.latitude.toFixed(6));
        setLngManual(pos.coords.longitude.toFixed(6));
        toast.success('Localização capturada!');
      },
      () => toast.error('Não foi possível obter a localização.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── Ações comuns ───────────────────────────────────────────────────────
  const desfazer = () => setPontos(prev => prev.slice(0, -1));
  const limpar = () => setPontos([]);

  const salvar = async () => {
    let payload;
    if (modo === 'ponto') {
      const lat = parseFloat(latManual), lng = parseFloat(lngManual);
      if (!isValidLatLng(lat, lng)) { toast.error('Coordenada inválida.'); return; }
      payload = { latitude: lat, longitude: lng, geojson: null, area_gps_ha: null };
    } else {
      if (pontos.length < 3) { toast.error('Marque pelo menos 3 pontos para formar a área.'); return; }
      const c = centroid(pontos);
      const a = polygonAreaHa(pontos);
      payload = {
        latitude: c.lat, longitude: c.lng,
        geojson: pointsToGeojson(pontos),
        area_gps_ha: Math.round(a * 1000) / 1000,
        area_ha: Math.round(a * 100) / 100, // atualiza a área do talhão com a medida real
      };
    }
    setSalvando(true);
    try {
      const updated = await updateTalhaoGeo(talhao.id, payload);
      toast.success('Localização do talhão salva!');
      onSaved?.(updated ?? payload);
      onClose?.();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const podeSalvar = modo === 'ponto'
    ? isValidLatLng(parseFloat(latManual), parseFloat(lngManual))
    : pontos.length >= 3;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="gradient-hero text-white px-4 py-3 flex items-center gap-2">
          <MapPin size={17} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight">Localização do talhão</p>
            <p className="text-[10.5px] text-white/70 truncate">{talhao?.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
        </div>

        {/* Seletor de modo */}
        <div className="flex gap-1 p-1.5 bg-muted/40">
          {MODOS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setModo(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-bold transition-all"
              style={modo === id ? { background: 'hsl(156 64% 31%)', color: 'white' } : { color: 'hsl(156 20% 40%)' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* ── MAPA ── */}
          {modo === 'mapa' && (
            <div>
              <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapDivRef} style={{ height: 320, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(152 14% 84%)', background: '#dddddd', position: 'relative', zIndex: 0, isolation: 'isolate' }} />
              </div>

              {/* Seletor de fonte de imagem — cobertura de satélite varia por região */}
              <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-1 px-1 pb-0.5">
                {FONTES_MAPA.map(f => (
                  <button key={f.id} type="button" onClick={() => setFonteId(f.id)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all whitespace-nowrap"
                    style={fonteId === f.id
                      ? { background: 'hsl(156 64% 31%)', color: 'white' }
                      : { background: 'hsl(156 25% 93%)', color: 'hsl(156 40% 30%)' }}>
                    {f.tipo === 'satelite' ? '🛰 ' : '🗺 '}{f.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{getFonte(fonteId).nota}</p>

              <div className="flex items-center gap-2 mt-2">
                <button onClick={localizarNoMapa} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: 'hsl(156 30% 92%)', color: 'hsl(156 45% 28%)' }}>
                  <Crosshair size={13} /> Minha localização
                </button>
                <button onClick={desfazer} disabled={!pontos.length} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'hsl(38 60% 92%)', color: '#b45309' }}>
                  <Undo2 size={13} /> Desfazer
                </button>
                <button onClick={limpar} disabled={!pontos.length} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'hsl(4 60% 94%)', color: '#dc2626' }}>
                  <Trash2 size={13} /> Limpar
                </button>
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-2">Toque no mapa para marcar os cantos do talhão (mín. 3).</p>
            </div>
          )}

          {/* ── CAMINHAR ── */}
          {modo === 'caminhar' && (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: watching ? 'hsl(156 64% 31% / 0.15)' : 'hsl(156 20% 92%)' }}>
                <Footprints size={30} style={{ color: 'hsl(156 64% 31%)' }} className={watching ? 'animate-pulse' : ''} />
              </div>
              <p className="text-[12px] text-muted-foreground max-w-xs">
                Fique num canto do talhão e toque em <strong>Iniciar</strong>. Caminhe pela borda; o app grava um ponto a cada ~4 m. Ao voltar ao início, toque em <strong>Parar</strong>.
              </p>
              <button onClick={toggleWalk}
                className="px-5 py-2.5 rounded-xl font-bold text-[13px] text-white"
                style={{ background: watching ? '#dc2626' : 'hsl(156 64% 31%)' }}>
                {watching ? 'Parar' : 'Iniciar caminhada'}
              </button>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>Pontos: <strong className="text-foreground">{pontos.length}</strong></span>
                {gpsAcc != null && <span>Precisão GPS: <strong className="text-foreground">±{gpsAcc} m</strong></span>}
              </div>
              {pontos.length > 0 && (
                <button onClick={limpar} className="text-[11px] font-bold text-red-500 flex items-center gap-1"><Trash2 size={12} /> Recomeçar</button>
              )}
            </div>
          )}

          {/* ── PONTO ── */}
          {modo === 'ponto' && (
            <div className="flex flex-col gap-3">
              <p className="text-[11.5px] text-muted-foreground">
                Marque apenas a coordenada central do talhão. Útil para ativar a previsão do tempo sem desenhar a área.
              </p>
              <button onClick={usarGpsPonto}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[12px] text-white" style={{ background: 'hsl(156 64% 31%)' }}>
                <Crosshair size={14} /> Usar meu GPS agora
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Latitude</label>
                  <input value={latManual} onChange={e => setLatManual(e.target.value)} placeholder="-15.7942"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm bg-background" style={{ borderColor: 'hsl(156 30% 80%)' }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Longitude</label>
                  <input value={lngManual} onChange={e => setLngManual(e.target.value)} placeholder="-47.8825"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm bg-background" style={{ borderColor: 'hsl(156 30% 80%)' }} />
                </div>
              </div>
            </div>
          )}

          {/* Resumo área (mapa/caminhar) */}
          {modo !== 'ponto' && pontos.length >= 3 && (
            <div className="mt-3 rounded-xl p-3 flex items-center justify-around" style={{ background: 'hsl(156 40% 95%)', border: '1px solid hsl(156 40% 85%)' }}>
              <div className="text-center">
                <p className="text-[17px] font-black leading-none" style={{ color: 'hsl(156 64% 28%)' }}>{area.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">hectares</p>
              </div>
              <div className="text-center">
                <p className="text-[17px] font-black leading-none" style={{ color: 'hsl(156 64% 28%)' }}>{Math.round(perimetro)}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">metros (perímetro)</p>
              </div>
              <div className="text-center">
                <p className="text-[17px] font-black leading-none" style={{ color: 'hsl(156 64% 28%)' }}>{pontos.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">vértices</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer salvar */}
        <div className="p-3 border-t border-border">
          <button onClick={salvar} disabled={!podeSalvar || salvando}
            className="w-full py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'hsl(156 64% 31%)' }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {salvando ? 'Salvando…' : (modo === 'ponto' ? 'Salvar localização' : `Salvar talhão (${area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha)`)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
