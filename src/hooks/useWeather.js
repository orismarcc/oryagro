import { useState, useEffect } from 'react';

const DEFAULT_CITY = { lat: -16.6864, lon: -49.2643, name: 'Goiânia, GO' };
const CACHE_KEY    = 'oryagro_weather_cache';
const CACHE_TTL    = 60 * 60 * 1000; // 1 hora
const DAYS_PT      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weatherEmoji(code) {
  if (code === 0)             return '☀️';
  if (code <= 2)              return '🌤️';
  if (code <= 3)              return '☁️';
  if (code <= 48)             return '🌫️';
  if (code <= 67)             return '🌦️';
  if (code <= 77)             return '🌨️';
  if (code <= 82)             return '🌧️';
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

// Alert level for agriculture: rain on spray/harvest days
export function weatherAlert(forecast) {
  if (!forecast) return null;
  const next2 = forecast.slice(0, 2);
  const heavyRain = next2.find(d => parseFloat(d.rain) > 10);
  if (heavyRain) return { day: heavyRain.dayName, msg: `Chuva forte prevista (${heavyRain.rain} mm) — evitar pulverizações`, level: 'warning' };
  return null;
}

async function fetchForecast(lat, lon, locName) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=America%2FSao_Paulo&forecast_days=5`;
  const res  = await fetch(url);
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

export function useWeather() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    // Check cache first
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setData(cached.data);
        setLocation(cached.location);
        setLoading(false);
        return;
      }
    } catch {}

    const load = async (lat, lon, locName) => {
      try {
        const forecast = await fetchForecast(lat, lon, locName);
        setData(forecast);
        setLocation(locName);
        setError(false);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: forecast, location: locName, ts: Date.now() }));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => load(pos.coords.latitude, pos.coords.longitude, 'Sua localização'),
        ()  => load(DEFAULT_CITY.lat, DEFAULT_CITY.lon, DEFAULT_CITY.name),
        { timeout: 5000 }
      );
    } else {
      load(DEFAULT_CITY.lat, DEFAULT_CITY.lon, DEFAULT_CITY.name);
    }
  }, []);

  return { data, loading, location, error, alert: weatherAlert(data) };
}
