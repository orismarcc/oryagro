/**
 * PropriedadeLocalCard.jsx — localização (lat/lon) da propriedade, compacta.
 *
 * Renderiza uma linha discreta para o CABEÇALHO (coordenadas + lápis de edição).
 * Ao editar, abre um mini-modal (portal) com GPS/entrada manual. Essa coordenada
 * é a base do clima: todo lote sem geometria própria usa esse ponto.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Crosshair, Check, Loader2, X, Pencil } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { updatePropriedadeLocal } from '../hooks/useSupabaseSync';
import { isValidLatLng } from '../lib/geo';

export default function PropriedadeLocalCard({ propriedade, onSaved }) {
  const toast = useToast();
  const [lat, setLat] = useState(propriedade?.latitude != null ? String(propriedade.latitude) : '');
  const [lon, setLon] = useState(propriedade?.longitude != null ? String(propriedade.longitude) : '');
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const definida = isValidLatLng(Number(propriedade?.latitude), Number(propriedade?.longitude));

  const usarGps = () => {
    if (!navigator.geolocation) { toast.error('GPS indisponível neste dispositivo.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        toast.success('Localização capturada!');
      },
      () => toast.error('Não foi possível obter a localização.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const salvar = async () => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    if (!isValidLatLng(la, lo)) { toast.error('Coordenada inválida.'); return; }
    setSalvando(true);
    try {
      await updatePropriedadeLocal(propriedade.id, { latitude: la, longitude: lo });
      toast.success('Localização salva! O clima já pode ser usado nos lotes.');
      onSaved?.({ latitude: la, longitude: lo });
      setEditando(false);
    } catch {
      toast.error('Erro ao salvar a localização.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {/* Linha compacta no cabeçalho */}
      <button onClick={() => setEditando(true)}
        className="flex items-center gap-1.5 text-white/60 text-[12px] hover:text-white/90 transition-colors">
        <MapPin size={11} />
        <span className="tabular-nums">
          {definida
            ? `${Number(propriedade.latitude).toFixed(4)}, ${Number(propriedade.longitude).toFixed(4)}`
            : 'Definir localização'}
        </span>
        <Pencil size={11} className="opacity-70" />
      </button>

      {/* Mini-modal de edição */}
      {editando && createPortal(
        <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setEditando(false)}>
          <div className="bg-background w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="gradient-hero text-white px-4 py-3 flex items-center gap-2">
              <MapPin size={16} />
              <p className="text-[14px] font-bold flex-1">Localização da propriedade</p>
              <button onClick={() => setEditando(false)} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
            </div>
            <div className="p-4 flex flex-col gap-2.5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
              <p className="text-[11px] text-muted-foreground">Base do clima e da irrigação para os lotes desta propriedade.</p>
              <button onClick={usarGps}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[12px] text-white"
                style={{ background: 'hsl(156 64% 31%)' }}>
                <Crosshair size={14} /> Usar meu GPS agora
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude (-15.7942)"
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-background" style={{ borderColor: 'hsl(156 30% 80%)' }} />
                <input value={lon} onChange={e => setLon(e.target.value)} placeholder="Longitude (-47.8825)"
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-background" style={{ borderColor: 'hsl(156 30% 80%)' }} />
              </div>
              <button onClick={salvar} disabled={salvando}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[13px] text-white disabled:opacity-40"
                style={{ background: 'hsl(156 64% 31%)' }}>
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {salvando ? 'Salvando…' : 'Salvar localização'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
