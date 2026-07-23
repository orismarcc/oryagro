/**
 * IrrigacaoPanel.jsx — manejo de irrigação com clima (#8).
 *
 * Busca a previsão do Open-Meteo para a coordenada do talhão, aplica o Kc da
 * cultura e mostra o balanço hídrico (ET0 × Kc − chuva) com recomendação de
 * lâmina de irrigação. Cacheia o último resultado (localStorage) para exibição
 * offline. Se não houver coordenada, convida a definir a localização.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Droplets, CloudRain, MapPin, RefreshCw, Loader2, Sun, AlertCircle, Timer, Settings2 } from 'lucide-react';
import {
  fetchPrevisao, calcularManejoIrrigacao, kcCultura, laminaParaLitros,
  resolverTaxaTalhao, eficienciaPadrao, tempoIrrigacao, sistemaIrrigacao,
} from '../lib/clima';
import { isValidLatLng } from '../lib/geo';

const NIVEL_STYLE = {
  irrigar: { bg: 'hsl(205 90% 95%)', border: 'hsl(205 80% 82%)', fg: '#0369a1', Icon: Droplets },
  segurar: { bg: 'hsl(38 90% 95%)', border: 'hsl(38 85% 82%)', fg: '#b45309', Icon: CloudRain },
  ok:      { bg: 'hsl(142 50% 95%)', border: 'hsl(142 45% 82%)', fg: '#15803d', Icon: Sun },
};

function diaCurto(iso, hojeISO) {
  if (iso === hojeISO) return 'Hoje';
  const dt = new Date(iso + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '');
}

export default function IrrigacaoPanel({ lat, lon, culturaId, culturaNome, areaHa, onDefinirLocal, talhao = null, onConfigurarKit }) {
  const temLocal = isValidLatLng(lat, lon);
  const cacheKey = temLocal ? `clima_${lat.toFixed(3)}_${lon.toFixed(3)}_${culturaId || ''}` : null;

  const [manejo, setManejo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [obtidoEm, setObtidoEm] = useState(null);
  const kc = kcCultura(culturaId);
  const hojeISO = new Date().toISOString().slice(0, 10);

  const carregar = useCallback(async (force = false) => {
    if (!temLocal) return;
    // cache
    if (!force && cacheKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.obtidoEm < 3 * 3600 * 1000) {
          setManejo(cached.manejo); setObtidoEm(cached.obtidoEm); return;
        }
      } catch { /* ignore */ }
    }
    setLoading(true); setErro(null);
    try {
      const previsao = await fetchPrevisao(lat, lon);
      const m = calcularManejoIrrigacao(previsao, { kc, hojeISO });
      setManejo(m); setObtidoEm(Date.now());
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ manejo: m, obtidoEm: Date.now() }));
    } catch {
      // fallback: usa cache antigo se houver
      let usouCache = false;
      if (cacheKey) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached) { setManejo(cached.manejo); setObtidoEm(cached.obtidoEm); usouCache = true; }
        } catch { /* ignore */ }
      }
      if (!usouCache) setErro('Sem conexão para buscar a previsão. Tente novamente com internet.');
    } finally {
      setLoading(false);
    }
  }, [temLocal, cacheKey, lat, lon, kc, hojeISO]);

  useEffect(() => { carregar(false); }, [carregar]);

  // ── Sem localização ──
  if (!temLocal) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(205 70% 92%)' }}>
          <Droplets size={17} style={{ color: '#0369a1' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight">Manejo de irrigação</p>
          <p className="text-[11px] text-muted-foreground">Defina a localização do talhão para ativar a previsão do tempo.</p>
        </div>
        {onDefinirLocal && (
          <button onClick={onDefinirLocal} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl flex-shrink-0" style={{ background: 'hsl(156 64% 31%)', color: 'white' }}>
            <MapPin size={13} /> Definir
          </button>
        )}
      </div>
    );
  }

  const rec = manejo?.recomendacao;
  const style = rec ? (NIVEL_STYLE[rec.nivel] || NIVEL_STYLE.ok) : NIVEL_STYLE.ok;
  const RecIcon = style.Icon;
  const necessidadeHoje = manejo?.dias?.find(d => d.data === hojeISO)?.necessidade || 0;
  const litrosHoje = rec?.nivel === 'irrigar' && areaHa
    ? laminaParaLitros(necessidadeHoje, areaHa)
    : 0;

  // ── Sistema de irrigação instalado → tempo de acionamento ──
  const sistema = sistemaIrrigacao(talhao?.irrigacao_tipo);
  const taxaMmH = resolverTaxaTalhao(talhao);
  const eficSistema = Number(talhao?.irrigacao_eficiencia) || eficienciaPadrao(talhao?.irrigacao_tipo);
  const tempoHoje = (sistema && taxaMmH && necessidadeHoje > 0)
    ? tempoIrrigacao({ laminaMm: necessidadeHoje, taxaMmH, eficiencia: eficSistema })
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Droplets size={15} style={{ color: '#0369a1' }} />
        <span className="text-[13px] font-bold text-foreground flex-1">Manejo de irrigação</span>
        <button onClick={() => carregar(true)} disabled={loading} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {loading && !manejo ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: '#0369a1' }} /></div>
      ) : erro ? (
        <div className="flex items-center gap-2 py-3 text-[11.5px] text-muted-foreground">
          <AlertCircle size={15} style={{ color: '#b45309' }} /> {erro}
        </div>
      ) : rec ? (
        <>
          {/* Recomendação */}
          <div className="rounded-xl p-3" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
            <div className="flex items-center gap-2">
              <RecIcon size={17} style={{ color: style.fg }} />
              <span className="text-[13px] font-bold" style={{ color: style.fg }}>{rec.titulo}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{rec.texto}</p>
            {litrosHoje > 0 && (
              <p className="text-[11px] font-semibold mt-1" style={{ color: style.fg }}>
                ≈ {litrosHoje.toLocaleString('pt-BR')} litros para {areaHa} ha
              </p>
            )}
          </div>

          {/* ── Sistema instalado: quanto tempo ligar ── */}
          {sistema ? (
            <div className="mt-2 rounded-xl p-3" style={{ background: 'hsl(190 60% 96%)', border: '1px solid hsl(190 50% 85%)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Timer size={13} style={{ color: '#0e7490' }} />
                <span className="text-[11px] font-bold" style={{ color: '#0e7490' }}>{sistema.label}</span>
                <span className="text-[10px] text-muted-foreground">· {taxaMmH} mm/h · {Math.round(eficSistema * 100)}% efic.</span>
                {onConfigurarKit && (
                  <button onClick={onConfigurarKit} className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-black/5" title="Editar sistema">
                    <Settings2 size={13} />
                  </button>
                )}
              </div>
              {tempoHoje ? (
                <p className="text-[12.5px] text-foreground">
                  Ligar por <strong style={{ color: '#0e7490' }}>{tempoHoje.h > 0 ? `${tempoHoje.h}h ` : ''}{tempoHoje.min}min</strong> hoje
                  <span className="text-[11px] text-muted-foreground"> — aplica {tempoHoje.laminaBruta} mm brutos para entregar {necessidadeHoje} mm à planta.</span>
                </p>
              ) : (
                <p className="text-[11.5px] text-muted-foreground">
                  Nenhum acionamento necessário hoje — a chuva prevista cobre a demanda da cultura.
                </p>
              )}
            </div>
          ) : onConfigurarKit && (
            <button onClick={onConfigurarKit}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: 'hsl(190 50% 94%)', color: '#0e7490', border: '1px solid hsl(190 45% 85%)' }}>
              <Settings2 size={13} /> Tenho irrigação instalada — calcular tempo de acionamento
            </button>
          )}

          {/* Previsão 7 dias */}
          <div className="mt-3 overflow-x-auto -mx-1 px-1">
            <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
              {manejo.dias.filter(d => d.futuro).slice(0, 7).map(d => (
                <div key={d.data} className="flex-1 min-w-[46px] rounded-lg p-1.5 text-center" style={{ background: d.data === hojeISO ? 'hsl(205 70% 95%)' : 'hsl(150 15% 96%)' }}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{diaCurto(d.data, hojeISO)}</p>
                  <p className="text-[13px] font-black text-foreground mt-0.5">{d.tmax ?? '—'}°</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5" title="chuva prevista">
                    <CloudRain size={9} style={{ color: '#0369a1' }} />
                    <span className="text-[9px] text-muted-foreground">{d.chuva}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold" style={{ color: d.necessidade > 0.5 ? '#0369a1' : '#15803d' }} title="irrigação necessária (mm)">
                    💧{d.necessidade}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>Necessidade 7d: <strong className="text-foreground">{manejo.totalNecessidade7} mm</strong> · Chuva 7d: <strong className="text-foreground">{manejo.totalChuva7} mm</strong></span>
          </div>
          <p className="text-[9px] text-muted-foreground/70 mt-1.5 leading-tight">
            ET0 FAO (Open-Meteo) × Kc {kc.toFixed(2)}{culturaNome ? ` (${culturaNome})` : ''} − chuva. Não modela armazenamento no solo — use como apoio ao manejo.
            {obtidoEm && <> Atualizado {new Date(obtidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</>}
          </p>
        </>
      ) : (
        <p className="text-[11.5px] text-muted-foreground py-3">Sem dados de previsão.</p>
      )}
    </motion.div>
  );
}
