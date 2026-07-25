/**
 * TalhaoMapEditor.jsx — define a geometria/localização de um talhão (#7).
 *
 * Três formas:
 *   1. Mapa     — tocar no mapa de satélite para marcar os cantos.
 *   2. Caminhar — ir até cada canto e MARCAR manualmente, só com o GPS calibrado
 *                 (precisão ≤ 4 m). Marcação manual evita dois erros do modo
 *                 automático: pegar o trajeto com desvios e gravar pontos antes
 *                 do GPS assentar (que jogava o início dezenas de metros longe).
 *   3. Ponto    — só a coordenada central.
 *
 * Em ambos os modos com mapa os vértices são ARRASTÁVEIS: dá para puxar qualquer
 * canto para ajustar. Área/perímetro calculados localmente (lib/geo).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import {
  X, MapPin, Footprints, Crosshair, Undo2, Trash2, Check, Loader2,
  Map as MapIcon, Satellite, CheckCircle2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  polygonAreaHa, polygonPerimeter, centroid, pointsToGeojson, geojsonToPoints,
  isValidLatLng, haversine,
} from '../lib/geo';
import { updateTalhaoGeo } from '../hooks/useSupabaseSync';
import { FONTES_MAPA, FONTE_PADRAO, getFonte } from '../data/mapTiles';

const MODOS = [
  { id: 'mapa', label: 'Mapa', Icon: MapIcon },
  { id: 'caminhar', label: 'Caminhar', Icon: Footprints },
  { id: 'ponto', label: 'Ponto', Icon: Crosshair },
];

/** Precisão máxima do GPS (m) para permitir marcar um canto. */
const PRECISAO_OK = 4;
/** Distância do 1º ponto (m) a partir da qual oferecemos fechar a área. */
const RAIO_FECHAMENTO = 12;

/** Ícone de vértice (arrastável), numerado. */
function iconeVertice(n, destaque = false) {
  const cor = destaque ? '#f59e0b' : '#22c55e';
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${cor};border:2.5px solid #0f5132;
      box-shadow:0 2px 6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
      color:#0f5132;font:700 11px/1 system-ui">${n}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Ícone da posição atual do GPS. */
function iconeGps(preciso) {
  const cor = preciso ? '#2563eb' : '#9ca3af';
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${cor};border:3px solid #fff;
      box-shadow:0 0 0 2px ${cor}66,0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function TalhaoMapEditor({ talhao, onClose, onSaved, captureOnly = false }) {
  // captureOnly (ou talhão sem id): não grava no banco — devolve a geometria.
  const soCaptura = captureOnly || !talhao?.id;
  const toast = useToast();
  const [modo, setModo] = useState('mapa');
  const [pontos, setPontos] = useState(() => geojsonToPoints(talhao?.geojson));
  const [salvando, setSalvando] = useState(false);

  // ponto central manual
  const [latManual, setLatManual] = useState(talhao?.latitude != null ? String(talhao.latitude) : '');
  const [lngManual, setLngManual] = useState(talhao?.longitude != null ? String(talhao.longitude) : '');

  // GPS ao vivo (modo caminhar)
  const [gps, setGps] = useState(null);            // { lat, lng, acc }
  const [rastreando, setRastreando] = useState(false);
  const watchIdRef = useRef(null);

  const area = polygonAreaHa(pontos);
  const perimetro = polygonPerimeter(pontos);
  const comMapa = modo !== 'ponto';

  // ── Leaflet ───────────────────────────────────────────────────────────────
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const gpsLayerRef = useRef(null);
  const tileRef = useRef(null);
  const [fonteId, setFonteId] = useState(FONTE_PADRAO);
  const [ready, setReady] = useState(false);
  // Mantém o modo acessível dentro dos handlers do Leaflet (criados uma vez).
  const modoRef = useRef(modo);
  useEffect(() => { modoRef.current = modo; }, [modo]);

  /** Redesenha polígono + vértices arrastáveis. */
  const redraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    const grp = L.layerGroup();

    if (pontos.length >= 3) {
      L.polygon(pontos.map(p => [p.lat, p.lng]), { color: '#16a34a', weight: 2.5, fillOpacity: 0.22 }).addTo(grp);
    } else if (pontos.length === 2) {
      L.polyline(pontos.map(p => [p.lat, p.lng]), { color: '#16a34a', weight: 2.5, dashArray: '5' }).addTo(grp);
    }

    pontos.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], {
        icon: iconeVertice(i + 1, i === 0),
        draggable: true,
        autoPan: true,
      });
      m.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPontos(prev => prev.map((q, j) => (j === i ? { lat, lng } : q)));
      });
      // arrastar não deve criar ponto novo no mapa
      m.on('click', (e) => L.DomEvent.stopPropagation(e));
      m.addTo(grp);
    });

    grp.addTo(map);
    layerRef.current = grp;
  }, [pontos]);

  /** Desenha a posição atual do GPS (só no modo caminhar). */
  const redrawGps = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gpsLayerRef.current) { map.removeLayer(gpsLayerRef.current); gpsLayerRef.current = null; }
    if (modo !== 'caminhar' || !gps) return;
    const grp = L.layerGroup();
    const preciso = gps.acc <= PRECISAO_OK;
    L.circle([gps.lat, gps.lng], {
      radius: Math.max(gps.acc, 1), color: preciso ? '#2563eb' : '#9ca3af',
      weight: 1, fillOpacity: 0.12, dashArray: '4',
    }).addTo(grp);
    L.marker([gps.lat, gps.lng], { icon: iconeGps(preciso), interactive: false }).addTo(grp);
    grp.addTo(map);
    gpsLayerRef.current = grp;
  }, [gps, modo]);

  // init do mapa (compartilhado entre 'mapa' e 'caminhar')
  useEffect(() => {
    if (!comMapa || !mapDivRef.current || mapRef.current) return;
    const el = mapDivRef.current;
    const start = pontos.length ? centroid(pontos)
      : (isValidLatLng(talhao?.latitude, talhao?.longitude) ? { lat: talhao.latitude, lng: talhao.longitude }
      : { lat: -14.24, lng: -51.93 });

    delete L.Icon.Default.prototype._getIconUrl;

    const map = L.map(el, { zoomControl: true, attributionControl: true });
    map.setView([start.lat, start.lng], pontos.length ? 17 : 5);

    const fonte = getFonte(fonteId);
    tileRef.current = L.tileLayer(fonte.url, { maxZoom: fonte.maxZoom, attribution: fonte.attribution }).addTo(map);

    // No modo caminhar os pontos vêm do GPS — tocar no mapa não cria vértice.
    map.on('click', (e) => {
      if (modoRef.current !== 'mapa') return;
      setPontos(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    });

    mapRef.current = map;

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
      mapRef.current = null; layerRef.current = null; gpsLayerRef.current = null; tileRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comMapa]);

  // cursor conforme o modo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getContainer().style.cursor = modo === 'mapa' ? 'crosshair' : 'grab';
  }, [modo, ready]);

  // troca de fonte sem recriar o mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (tileRef.current) { try { tileRef.current.remove(); } catch { /* ok */ } }
    const fonte = getFonte(fonteId);
    tileRef.current = L.tileLayer(fonte.url, { maxZoom: fonte.maxZoom, attribution: fonte.attribution }).addTo(map);
  }, [fonteId, ready]);

  useEffect(() => { if (comMapa) redraw(); }, [pontos, comMapa, redraw]);
  useEffect(() => { redrawGps(); }, [redrawGps]);

  const localizarNoMapa = () => {
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18); },
      () => toast.error('Não foi possível obter a localização.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── GPS ao vivo (modo caminhar) ──────────────────────────────────────────
  const iniciarGps = useCallback(() => {
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    if (watchIdRef.current != null) return;
    setRastreando(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGps({ lat: latitude, lng: longitude, acc: Math.round(accuracy) });
      },
      () => { toast.error('Falha no GPS. Verifique a permissão de localização.'); setRastreando(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, [toast]);

  const pararGps = useCallback(() => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setRastreando(false);
  }, []);

  // liga/desliga o GPS ao entrar/sair do modo caminhar
  useEffect(() => {
    if (modo === 'caminhar') iniciarGps(); else pararGps();
    return () => pararGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const precisoOk = gps != null && gps.acc <= PRECISAO_OK;

  /** Distância da posição atual ao 1º ponto — para oferecer fechar a área. */
  const distAoPrimeiro = (gps && pontos.length >= 3)
    ? haversine({ lat: gps.lat, lng: gps.lng }, pontos[0])
    : null;
  const podeFechar = distAoPrimeiro != null && distAoPrimeiro <= RAIO_FECHAMENTO;

  const marcarPonto = () => {
    if (!gps) { toast.error('Aguardando o GPS…'); return; }
    if (!precisoOk) { toast.error(`Precisão ±${gps.acc} m — aguarde chegar a ±${PRECISAO_OK} m.`); return; }
    const novo = { lat: gps.lat, lng: gps.lng };
    setPontos(prev => [...prev, novo]);
    mapRef.current?.setView([novo.lat, novo.lng], Math.max(mapRef.current.getZoom(), 18));
  };

  const desfazer = () => setPontos(prev => prev.slice(0, -1));
  const limpar = () => setPontos([]);

  // ── Salvar ───────────────────────────────────────────────────────────────
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
        area_ha: Math.round(a * 100) / 100,
      };
    }

    if (soCaptura) {
      onSaved?.(payload);
      toast.success('Área demarcada!');
      onClose?.();
      return;
    }
    setSalvando(true);
    try {
      const updated = await updateTalhaoGeo(talhao.id, payload);
      if (updated?._queued) {
        toast.warning('Sem sinal — salvo no aparelho. Sincroniza sozinho quando a internet voltar.');
      } else {
        toast.success('Localização do talhão salva!');
      }
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

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="gradient-hero text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <MapPin size={17} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight">Localização do talhão</p>
            <p className="text-[10.5px] text-white/70 truncate">{talhao?.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
        </div>

        {/* Seletor de modo */}
        <div className="flex gap-1 p-1.5 bg-muted/40 flex-shrink-0">
          {MODOS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setModo(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-bold transition-all"
              style={modo === id ? { background: 'hsl(156 64% 31%)', color: 'white' } : { color: 'hsl(156 20% 40%)' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* ── MAPA (compartilhado por 'mapa' e 'caminhar') ── */}
          {comMapa && (
            <>
              <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapDivRef} style={{
                  height: 300, width: '100%', borderRadius: 12, overflow: 'hidden',
                  border: '1px solid hsl(152 14% 84%)', background: '#dddddd',
                  position: 'relative', zIndex: 0, isolation: 'isolate',
                }} />
              </div>

              {/* Fontes de satélite */}
              <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-1 px-1 pb-0.5">
                {FONTES_MAPA.map(f => (
                  <button key={f.id} type="button" onClick={() => setFonteId(f.id)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all whitespace-nowrap"
                    style={fonteId === f.id
                      ? { background: 'hsl(156 64% 31%)', color: 'white' }
                      : { background: 'hsl(156 25% 93%)', color: 'hsl(156 40% 30%)' }}>
                    {f.tipo === 'satelite' ? <Satellite size={11} className="inline mr-1" /> : '🗺 '}{f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button onClick={localizarNoMapa} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: 'hsl(156 30% 92%)', color: 'hsl(156 45% 28%)' }}>
                  <Crosshair size={13} /> Centralizar em mim
                </button>
                <button onClick={desfazer} disabled={!pontos.length} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'hsl(38 60% 92%)', color: '#b45309' }}>
                  <Undo2 size={13} /> Desfazer
                </button>
                <button onClick={limpar} disabled={!pontos.length} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'hsl(4 60% 94%)', color: '#dc2626' }}>
                  <Trash2 size={13} /> Limpar
                </button>
              </div>

              <p className="text-[10.5px] text-muted-foreground mt-2">
                {modo === 'mapa'
                  ? 'Toque no mapa para marcar os cantos (mín. 3). Arraste qualquer ponto para ajustar.'
                  : 'Arraste qualquer ponto no mapa para corrigir a posição.'}
              </p>
            </>
          )}

          {/* ── CAMINHAR: painel de GPS + marcação manual ── */}
          {modo === 'caminhar' && (
            <div className="mt-3 rounded-2xl p-3.5" style={{ background: 'hsl(156 30% 96%)', border: '1px solid hsl(156 30% 86%)' }}>
              {/* Estado do GPS */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: precisoOk ? 'hsl(142 60% 88%)' : 'hsl(38 80% 90%)' }}>
                  <Satellite size={16} className={rastreando && !precisoOk ? 'animate-pulse' : ''}
                    style={{ color: precisoOk ? '#15803d' : '#b45309' }} />
                </div>
                <div className="flex-1 min-w-0">
                  {!gps ? (
                    <p className="text-[12px] font-bold text-foreground">Procurando satélites…</p>
                  ) : (
                    <>
                      <p className="text-[12px] font-bold text-foreground">
                        Precisão ±{gps.acc} m
                        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={precisoOk
                            ? { background: 'hsl(142 60% 88%)', color: '#15803d' }
                            : { background: 'hsl(38 80% 90%)', color: '#b45309' }}>
                          {precisoOk ? 'pronto' : `aguarde ±${PRECISAO_OK} m`}
                        </span>
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {precisoOk ? 'Pode marcar este canto.' : 'Fique parado alguns segundos até o GPS assentar.'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Marcar canto */}
              <button onClick={marcarPonto} disabled={!precisoOk}
                className="w-full mt-3 py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'hsl(156 64% 31%)' }}>
                <MapPin size={16} />
                {pontos.length === 0 ? 'Marcar 1º canto (aqui)' : `Marcar canto ${pontos.length + 1}`}
              </button>

              {/* Fechar área ao voltar perto do 1º ponto */}
              {podeFechar && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-2 rounded-xl p-2.5 flex items-center gap-2"
                  style={{ background: 'hsl(142 55% 92%)', border: '1px solid hsl(142 50% 78%)' }}>
                  <CheckCircle2 size={15} style={{ color: '#15803d' }} />
                  <p className="text-[11px] flex-1" style={{ color: '#166534' }}>
                    Você está a {Math.round(distAoPrimeiro)} m do 1º canto — a área já pode ser fechada.
                  </p>
                </motion.div>
              )}

              <div className="flex items-center justify-between mt-2.5 text-[11px] text-muted-foreground">
                <span>Cantos marcados: <strong className="text-foreground">{pontos.length}</strong></span>
                {pontos.length > 0 && (
                  <button onClick={desfazer} className="font-bold flex items-center gap-1" style={{ color: '#b45309' }}>
                    <Undo2 size={12} /> Desfazer último
                  </button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                Vá até cada canto do talhão e marque com o GPS calibrado. Assim o
                contorno não pega os desvios do caminho.
              </p>
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

          {/* Resumo da área */}
          {comMapa && pontos.length >= 3 && (
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
        <div className="p-3 border-t border-border flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button onClick={salvar} disabled={!podeSalvar || salvando}
            className="w-full py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: podeFechar ? '#15803d' : 'hsl(156 64% 31%)' }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {salvando ? 'Salvando…'
              : modo === 'ponto' ? 'Salvar localização'
              : podeFechar ? `Fechar área e salvar (${area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha)`
              : `Salvar talhão (${area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha)`}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
