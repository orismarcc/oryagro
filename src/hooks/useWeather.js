import { useState, useEffect } from 'react';

// Cidade padrão usada somente se não houver cidade da propriedade nem GPS
const DEFAULT_CITY = { lat: -10.6384, lon: -51.5647, name: 'Confresa, MT' };
const CACHE_KEY    = 'oryagro_weather_v2';   // v2: chave separada por cidade
const CACHE_TTL    = 60 * 60 * 1000;         // 1 hora
const DAYS_PT      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weatherEmoji(code) {
  if (code === 0)   return '☀️';
  if (code <= 2)    return '🌤️';
  if (code <= 3)    return '☁️';
  if (code <= 48)   return '🌫️';
  if (code <= 67)   return '🌦️';
  if (code <= 77)   return '🌨️';
  if (code <= 82)   return '🌧️';
  return '⛈️';
}

export function weatherLabel(code) {
  if (code === 0)  return 'Ensolarado';
  if (code <= 2)   return 'P. nublado';
  if (code <= 3)   return 'Nublado';
  if (code <= 48)  return 'Névoa';
  if (code <= 67)  return 'Chuva';
  if (code <= 77)  return 'Neve';
  if (code <= 82)  return 'Chuva forte';
  return 'Tempestade';
}

export function weatherAlert(forecast) {
  if (!forecast) return null;
  const next2    = forecast.slice(0, 2);
  const heavyRain = next2.find(d => parseFloat(d.rain) > 10);
  if (heavyRain)
    return {
      day:   heavyRain.dayName,
      msg:   `Chuva forte prevista (${heavyRain.rain} mm) — evitar pulverizações`,
      level: 'warning',
    };
  return null;
}

// Polyfill para AbortSignal.timeout (Chrome < 103, Safari < 15.4, Android WebView antigo)
function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// ── Geocodifica "Cidade, UF" → { lat, lon } usando Open-Meteo Geocoding ──────
async function geocodeCity(cidade, estado) {
  const query = estado ? `${cidade}, ${estado}` : cidade;
  const url   = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=5&language=pt&format=json`;
  const res   = await fetch(url, { signal: timeoutSignal(5000) });
  if (!res.ok) throw new Error('geocode failed');
  const json = await res.json();
  if (!json.results?.length) throw new Error('city not found');

  // Prefere o resultado do mesmo estado (se informado)
  let best = json.results[0];
  if (estado) {
    const uf = estado.trim().toUpperCase();
    const match = json.results.find(
      r => r.admin1?.toUpperCase().includes(uf) ||
           r.country_code === 'BR' && r.admin1_id != null
    );
    if (match) best = match;
  }
  return { lat: best.latitude, lon: best.longitude, name: best.name };
}

// ── Busca previsão na Open-Meteo ─────────────────────────────────────────────
async function fetchForecast(lat, lon, locName) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=America%2FSao_Paulo&forecast_days=5`;
  const res  = await fetch(url, { signal: timeoutSignal(8000) });
  if (!res.ok) throw new Error('weather fetch failed');
  const json = await res.json();
  const d    = json.daily;
  return d.time.map((date, i) => {
    const dt = new Date(date + 'T12:00:00');
    return {
      date,
      dayName: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DAYS_PT[dt.getDay()],
      emoji:   weatherEmoji(d.weathercode[i]),
      label:   weatherLabel(d.weathercode[i]),
      max:     Math.round(d.temperature_2m_max[i]),
      min:     Math.round(d.temperature_2m_min[i]),
      rain:    (d.precipitation_sum[i] ?? 0).toFixed(1),
      code:    d.weathercode[i],
    };
  });
}

// ── Hook principal ────────────────────────────────────────────────────────────
/**
 * @param {{ cidade?: string, estado?: string }} location
 *   cidade/estado da propriedade do lote (opcional). Se fornecidos, são usados
 *   como fonte primária de localização em vez de GPS.
 */
export function useWeather({ cidade, estado } = {}) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    let cancelled = false;

    const saveCache = (key, forecast, locName) => {
      try {
        const map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        map[key] = { data: forecast, location: locName, ts: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(map));
      } catch {}
    };

    const readCache = (key) => {
      try {
        const map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const entry = map[key];
        if (entry && Date.now() - entry.ts < CACHE_TTL) return entry;
      } catch {}
      return null;
    };

    const applyResult = (forecast, locName) => {
      if (cancelled) return;
      setData(forecast);
      setLocation(locName);
      setError(false);
      setLoading(false);
    };

    const load = async (lat, lon, locName, cacheKey) => {
      // Verifica cache específico desta cidade/coordenada
      const cached = readCache(cacheKey);
      if (cached) { applyResult(cached.data, cached.location); return; }

      try {
        const forecast = await fetchForecast(lat, lon, locName);
        saveCache(cacheKey, forecast, locName);
        applyResult(forecast, locName);
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    };

    const run = async () => {
      // ── Prioridade 1: cidade da propriedade (mais confiável no APK) ──────
      if (cidade && cidade.trim()) {
        const cacheKey = `prop_${cidade.trim().toLowerCase()}_${(estado || '').toLowerCase()}`;
        const cached = readCache(cacheKey);
        if (cached) { applyResult(cached.data, cached.location); return; }

        try {
          const geo = await geocodeCity(cidade.trim(), estado);
          const label = estado ? `${geo.name}, ${estado}` : geo.name;
          await load(geo.lat, geo.lon, label, cacheKey);
          return;
        } catch {
          // Geocodificação falhou → tenta GPS ou fallback
        }
      }

      // ── Prioridade 2: GPS do dispositivo ─────────────────────────────────
      const tryGPS = () =>
        new Promise((resolve, reject) => {
          if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err => reject(err),
            { timeout: 5000, maximumAge: 300_000 },
          );
        });

      try {
        const pos      = await tryGPS();
        const cacheKey = `gps_${pos.lat.toFixed(2)}_${pos.lon.toFixed(2)}`;
        await load(pos.lat, pos.lon, 'Sua localização', cacheKey);
        return;
      } catch {
        // GPS negado ou indisponível → usa cidade padrão
      }

      // ── Prioridade 3: cidade padrão (Confresa, MT) ────────────────────────
      await load(DEFAULT_CITY.lat, DEFAULT_CITY.lon, DEFAULT_CITY.name, 'default');
    };

    run();
    return () => { cancelled = true; };
  }, [cidade, estado]);   // re-executa se a cidade da propriedade mudar

  return { data, loading, location, error, alert: weatherAlert(data) };
}
