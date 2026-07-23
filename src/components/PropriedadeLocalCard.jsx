/**
 * PropriedadeLocalCard.jsx — define a localização (lat/lon) da propriedade.
 *
 * Essa coordenada é a base do clima: todo lote da propriedade que não tenha
 * geometria própria usa esse ponto para buscar a previsão e calcular o
 * balanço hídrico da irrigação.
 */
import React, { useState } from 'react';
import { MapPin, Crosshair, Check, Loader2, X } from 'lucide-react';
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
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: definida ? 'hsl(156 64% 31% / 0.14)' : 'hsl(205 60% 92%)' }}>
          <MapPin size={17} style={{ color: definida ? 'hsl(156 64% 31%)' : '#0369a1' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-tight">Localização da propriedade</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {definida
              ? `${Number(propriedade.latitude).toFixed(4)}, ${Number(propriedade.longitude).toFixed(4)} — clima ativo nos lotes`
              : 'Defina para ativar a previsão do tempo e a irrigação nos lotes'}
          </p>
        </div>
        <button onClick={() => setEditando(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl flex-shrink-0"
          style={{ background: 'hsl(156 64% 31% / 0.10)', color: 'hsl(156 64% 31%)', border: '1px solid hsl(156 64% 31% / 0.25)' }}>
          {editando ? <X size={13} /> : <MapPin size={13} />}
          {editando ? 'Cancelar' : (definida ? 'Editar' : 'Definir')}
        </button>
      </div>

      {editando && (
        <div className="mt-3 flex flex-col gap-2.5">
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
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[12px] text-white disabled:opacity-40"
            style={{ background: 'hsl(156 64% 31%)' }}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {salvando ? 'Salvando…' : 'Salvar localização'}
          </button>
        </div>
      )}
    </div>
  );
}
