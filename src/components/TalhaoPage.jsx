/**
 * TalhaoPage.jsx — Página de detalhe de um Talhão (cultura perene)
 *
 * Exibe todas as safras de um talhão perene (acerola, banana, etc.),
 * o histórico de produção, e permite iniciar nova safra.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, CheckCircle2, Clock, TrendingUp, Leaf, BarChart2, Calendar, AlertCircle, Loader2, Trash2, MapPin, Ruler } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { loadSafrasDeTalhao, criarSafraDeTalhao, deleteTalhaoComSeguranca } from '../hooks/useSupabaseSync';
import TalhaoMapEditor from './TalhaoMapEditor';
import IrrigacaoPanel from './IrrigacaoPanel';
import IrrigacaoKitForm from './IrrigacaoKitForm';
import { isValidLatLng, geojsonToPoints } from '../lib/geo';
import { resolveLifecycle } from '../lib/lifecycle';
import { useToast } from '../context/ToastContext';
import { useFarm } from '../context/FarmContext';
import { can, FARM_ACTIONS } from '../lib/permissions';

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtKg(v) {
  const n = Number(v || 0);
  return n >= 1000 ? `${(n/1000).toFixed(1)}t` : `${n.toLocaleString('pt-BR')} kg`;
}

function idadeAnos(dataImplantacao) {
  if (!dataImplantacao) return null;
  const anos = (Date.now() - new Date(dataImplantacao + 'T12:00:00').getTime()) / (365.25 * 86400000);
  if (anos < 1) return `${Math.round(anos * 12)} meses`;
  return `${anos.toFixed(1)} anos`;
}

// ── Safra Card ─────────────────────────────────────────────────────────────────
function SafraCard({ safra, cultura, onSelectSafra, index }) {
  const cor = cultura?.cor ?? '#16a34a';
  const isAtiva = safra.status === 'ativo';

  let lc = null;
  try { lc = isAtiva ? resolveLifecycle(safra, cultura) : null; } catch { }

  const diasDecorridos = lc?.diasDecorridos ?? null;
  const progresso = lc?.progresso ?? null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => onSelectSafra(safra)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${isAtiva ? cor : '#d1d5db'}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0"
          style={{ background: isAtiva ? `${cor}20` : '#f3f4f6', color: isAtiva ? cor : '#6b7280' }}
        >
          S{safra.safra_numero ?? index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-foreground">
              {safra.safra_numero ? `${safra.safra_numero}ª Safra` : `Safra ${index + 1}`}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={isAtiva
                ? { background: `${cor}20`, color: cor }
                : { background: '#f3f4f6', color: '#6b7280' }}
            >
              {isAtiva ? '● Ativa' : '✓ Concluída'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            <span>Plantio: {fmtDate(safra.data_plantio)}</span>
            {isAtiva && diasDecorridos !== null && (
              <span>· Dia {diasDecorridos} do ciclo</span>
            )}
            {!isAtiva && safra.data_conclusao && (
              <span>· Concluída: {fmtDate(safra.data_conclusao)}</span>
            )}
          </div>
        </div>
        {isAtiva && progresso !== null && (
          <div className="text-right flex-shrink-0">
            <div className="text-[13px] font-black" style={{ color: cor }}>{progresso}%</div>
            <div className="text-[9px] text-muted-foreground">até 1ª col.</div>
          </div>
        )}
      </div>
      {isAtiva && progresso !== null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(140 14% 93%)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progresso}%`, background: cor }}
          />
        </div>
      )}
    </motion.button>
  );
}

// ── Dialog: Nova Safra ─────────────────────────────────────────────────────────
function NovaSafraDialog({ talhao, cultura, onClose, onCreated }) {
  const toast = useToast();
  const [dataSafra, setDataSafra] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const cor = cultura?.cor ?? '#16a34a';

  const handleCreate = async () => {
    setSaving(true);
    try {
      const safra = await criarSafraDeTalhao(talhao.id, dataSafra, talhao);
      if (safra) {
        toast.success('Nova safra iniciada!');
        onCreated(safra);
      } else {
        toast.error('Erro ao criar safra. Tente novamente.');
      }
    } catch (e) {
      toast.error('Erro ao criar safra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative bg-background rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-2xl"
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
      >
        <h3 className="text-[15px] font-bold text-foreground mb-1">Iniciar Nova Safra</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          {talhao.nome} · {cultura?.nome ?? talhao.cultura_id}
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Data de início da safra
            </label>
            <input
              type="date"
              value={dataSafra}
              onChange={e => setDataSafra(e.target.value)}
              className="w-full mt-1 rounded-xl border border-input px-3 py-2 text-sm bg-background outline-none"
              style={{ borderColor: `${cor}40` }}
            />
          </div>

          <div className="rounded-xl px-3 py-2.5 text-[11px]"
            style={{ background: `${cor}10`, color: cor, border: `1px solid ${cor}30` }}>
            <p className="font-semibold mb-0.5">Esta é uma safra de cultura perene</p>
            <p className="opacity-80">
              As {talhao.total_plantas?.toLocaleString('pt-BR') ?? '?'} plantas continuam — apenas iniciando
              um novo período de acompanhamento.
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-input text-[13px] font-medium text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !dataSafra}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: cor }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Criando…' : 'Iniciar Safra'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TalhaoPage({ talhao, onBack, onSelectLote }) {
  const cultura = CULTURAS[talhao.cultura_id];
  const cor = cultura?.cor ?? '#16a34a';
  const toast = useToast();
  const { getUserRole } = useFarm();
  const canDelete = can(getUserRole(talhao.propriedade_id), FARM_ACTIONS.DELETE_ANY);

  const [safras, setSafras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNovaSafra, setShowNovaSafra] = useState(false);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showKitForm, setShowKitForm] = useState(false);
  // cópia local dos campos de geo para refletir na tela após salvar
  const [geo, setGeo] = useState({
    latitude: talhao.latitude, longitude: talhao.longitude,
    geojson: talhao.geojson, area_gps_ha: talhao.area_gps_ha, area_ha: talhao.area_ha,
  });
  // cópia local do sistema de irrigação instalado
  const [kit, setKit] = useState({
    irrigacao_tipo: talhao.irrigacao_tipo,
    irrigacao_taxa_mm_h: talhao.irrigacao_taxa_mm_h,
    irrigacao_vazao_emissor_lh: talhao.irrigacao_vazao_emissor_lh,
    irrigacao_area_emissor_m2: talhao.irrigacao_area_emissor_m2,
    irrigacao_eficiencia: talhao.irrigacao_eficiencia,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTalhao = async () => {
    setDeleting(true);
    const res = await deleteTalhaoComSeguranca(talhao.id);
    setDeleting(false);
    if (res.ok) {
      toast.success('Talhão excluído.');
      onBack();   // volta para a propriedade (que recarrega a lista de talhões)
    } else if (res.reason === 'has_data') {
      toast.error('Este talhão tem safras com dados (vendas, despesas ou etapas concluídas). Exclua ou arquive as safras antes.');
      setConfirmDelete(false);
    } else {
      toast.error('Não foi possível excluir o talhão. Tente novamente.');
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    loadSafrasDeTalhao(talhao.id).then(rows => {
      setSafras(rows ?? []);
      setLoading(false);
    });
  }, [talhao.id]);

  const safrasAtivas     = safras.filter(s => s.status === 'ativo');
  const safrasConcluidas = safras.filter(s => s.status !== 'ativo');

  // Métricas históricas
  const totalKg      = safrasConcluidas.reduce((s, c) => s + parseFloat(c._kg ?? 0), 0);
  const idade        = idadeAnos(talhao.data_implantacao);

  const handleSafraCreated = (novaSafra) => {
    setSafras(prev => [...prev, novaSafra]);
    setShowNovaSafra(false);
    // Navegar direto para a nova safra
    if (onSelectLote) onSelectLote(novaSafra);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Hero ── */}
      <div className="gradient-hero px-5 pb-6" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            {cultura?.emoji ?? '🌱'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-extrabold text-white leading-tight truncate">
              {talhao.nome}
            </h1>
            <p className="text-white/60 text-[11px] mt-0.5">
              {cultura?.nome ?? talhao.cultura_id} · {talhao.area_ha ?? '?'} ha · {talhao.total_plantas?.toLocaleString('pt-BR') ?? '?'} plantas
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[20px] font-black text-white leading-none">
              {idade ?? '—'}
            </div>
            <div className="text-[9px] text-white/50 mt-0.5">de vida</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Safras concluídas', value: safrasConcluidas.length },
            { label: 'Safras ativas', value: safrasAtivas.length },
            { label: 'Total histórico', value: safras.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl px-3 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.10)' }}>
              <div className="text-[16px] font-black text-white">{value}</div>
              <div className="text-[9px] text-white/50 leading-tight mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="page-body flex flex-col gap-5 pt-5 pb-8 flex-1">

        {/* Botão nova safra */}
        <button
          onClick={() => setShowNovaSafra(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px]"
          style={{ background: cor, color: 'white' }}
        >
          <Plus size={15} /> Nova Safra
        </button>

        {/* ── Localização & mapa do talhão (#7) ── */}
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cor}18` }}>
              <MapPin size={17} style={{ color: cor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-tight">Localização do talhão</p>
              <p className="text-[11px] text-muted-foreground">
                {isValidLatLng(geo.latitude, geo.longitude)
                  ? (geo.area_gps_ha
                    ? `Área medida por GPS: ${Number(geo.area_gps_ha).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha`
                    : 'Ponto central definido')
                  : 'Ainda não definida'}
              </p>
            </div>
            <button onClick={() => setShowMapEditor(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl flex-shrink-0"
              style={{ background: `${cor}12`, color: cor, border: `1px solid ${cor}30` }}>
              <MapPin size={13} /> {isValidLatLng(geo.latitude, geo.longitude) ? 'Editar' : 'Definir'}
            </button>
          </div>
          {geojsonToPoints(geo.geojson).length >= 3 && (
            <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-muted-foreground">
              <Ruler size={12} style={{ color: cor }} />
              Polígono com {geojsonToPoints(geo.geojson).length} vértices salvo.
            </div>
          )}
        </div>

        {/* ── Manejo de irrigação com clima (#8) ── */}
        <IrrigacaoPanel
          lat={geo.latitude} lon={geo.longitude}
          culturaId={talhao.cultura_id} culturaNome={cultura?.nome}
          areaHa={parseFloat(geo.area_ha) || parseFloat(talhao.area_ha) || null}
          onDefinirLocal={() => setShowMapEditor(true)}
          talhao={{ ...talhao, ...kit }}
          onConfigurarKit={() => setShowKitForm(true)}
        />

        {/* Safras ativas */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: cor }} />
          </div>
        ) : (
          <>
            {safrasAtivas.length > 0 && (
              <div>
                <p className="section-label mb-2">Safras em andamento</p>
                <div className="flex flex-col gap-2">
                  {safrasAtivas.map((s, i) => (
                    <SafraCard
                      key={s.id}
                      safra={s}
                      cultura={cultura}
                      onSelectSafra={onSelectLote}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {safrasConcluidas.length > 0 && (
              <div>
                <p className="section-label mb-2">Safras concluídas</p>
                <div className="flex flex-col gap-2">
                  {safrasConcluidas.map((s, i) => (
                    <SafraCard
                      key={s.id}
                      safra={s}
                      cultura={cultura}
                      onSelectSafra={onSelectLote}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {safras.length === 0 && (
              <div className="card p-8 text-center">
                <div className="text-4xl mb-3">{cultura?.emoji ?? '🌱'}</div>
                <p className="text-[13px] font-semibold text-foreground">Nenhuma safra ainda</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Clique em "Nova Safra" para iniciar o acompanhamento da 1ª safra deste talhão.
                </p>
              </div>
            )}
          </>
        )}

        {/* Info do talhão */}
        <div className="card p-4">
          <p className="text-[12px] font-bold text-foreground mb-3">Informações do Talhão</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { label: 'Implantado em', value: fmtDate(talhao.data_implantacao) },
              { label: 'Área', value: talhao.area_ha ? `${talhao.area_ha} ha` : '—' },
              { label: 'Plantas', value: talhao.total_plantas?.toLocaleString('pt-BR') ?? '—' },
              { label: 'Propagação', value: talhao.metodo_propagacao ?? '—' },
              { label: 'Espaçamento', value: talhao.espacamento_linhas ? `${talhao.espacamento_linhas}×${talhao.espacamento_plantas}m` : '—' },
              { label: 'Status', value: talhao.status === 'ativo' ? '● Ativo' : '○ Inativo' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-[12px] font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {talhao.observacoes && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Observações</p>
              <p className="text-[12px] text-foreground">{talhao.observacoes}</p>
            </div>
          )}

          {/* Excluir talhão */}
          {canDelete && (
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              {confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Excluir este talhão?</span>
                  <button
                    onClick={handleDeleteTalhao}
                    disabled={deleting}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>
                    {deleting ? '…' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                    style={{ background: 'hsl(140 14% 93%)', color: 'hsl(150 8% 45%)' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 size={13} /> Excluir talhão
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog ── */}
      <AnimatePresence>
        {showNovaSafra && (
          <NovaSafraDialog
            talhao={talhao}
            cultura={cultura}
            onClose={() => setShowNovaSafra(false)}
            onCreated={handleSafraCreated}
          />
        )}
      </AnimatePresence>

      {showMapEditor && (
        <TalhaoMapEditor
          talhao={{ ...talhao, ...geo }}
          onClose={() => setShowMapEditor(false)}
          onSaved={(updated) => setGeo(g => ({
            ...g,
            latitude: updated.latitude ?? g.latitude,
            longitude: updated.longitude ?? g.longitude,
            geojson: updated.geojson !== undefined ? updated.geojson : g.geojson,
            area_gps_ha: updated.area_gps_ha !== undefined ? updated.area_gps_ha : g.area_gps_ha,
            area_ha: updated.area_ha ?? g.area_ha,
          }))}
        />
      )}

      {showKitForm && (
        <IrrigacaoKitForm
          talhao={{ ...talhao, ...kit }}
          onClose={() => setShowKitForm(false)}
          onSaved={(updated) => setKit({
            irrigacao_tipo: updated.irrigacao_tipo ?? null,
            irrigacao_taxa_mm_h: updated.irrigacao_taxa_mm_h ?? null,
            irrigacao_vazao_emissor_lh: updated.irrigacao_vazao_emissor_lh ?? null,
            irrigacao_area_emissor_m2: updated.irrigacao_area_emissor_m2 ?? null,
            irrigacao_eficiencia: updated.irrigacao_eficiencia ?? null,
          })}
        />
      )}
    </div>
  );
}
