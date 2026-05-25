import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { motion } from 'framer-motion';
import { BookOpen, Loader2, PenLine, Trash2 } from 'lucide-react';
import {
  loadDiario,
  addDiarioEntry,
  deleteDiarioEntry,
} from '../../hooks/useGestao';
import { today, formatDatePtBR } from './shared';

const TIPO_OPTIONS = [
  { value: 'anotacao',  label: '📝 Anotação' },
  { value: 'clima',     label: '🌦 Clima' },
  { value: 'praga',     label: '🐛 Praga/Doença' },
  { value: 'visita',    label: '👤 Visita técnica' },
  { value: 'irrigacao', label: '💧 Irrigação' },
  { value: 'outros',    label: '📌 Outros' },
];

const TIPO_BADGE_STYLE = {
  anotacao:  { background: '#dbeafe', color: '#1e40af' },
  clima:     { background: '#e0f2fe', color: '#0369a1' },
  praga:     { background: '#fee2e2', color: '#991b1b' },
  visita:    { background: '#f3e8ff', color: '#6b21a8' },
  irrigacao: { background: '#cffafe', color: '#155e75' },
  outros:    { background: '#f3f4f6', color: '#374151' },
};

function TipoBadge({ tipo }) {
  const style = TIPO_BADGE_STYLE[tipo] ?? TIPO_BADGE_STYLE.outros;
  const opt = TIPO_OPTIONS.find(t => t.value === tipo);
  const label = opt ? opt.label : tipo;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  );
}

function TabDiario({ lote, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const toast = useToast();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    data: today(),
    tipo: 'anotacao',
    texto: '',
  });

  const fetchDiario = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadDiario(lote.id);
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [lote.id]);

  useEffect(() => {
    fetchDiario();
  }, [fetchDiario]);

  const handleAdd = async () => {
    if (!form.texto.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      await addDiarioEntry({
        plantioId: lote.id,
        data: form.data,
        tipo: form.tipo,
        texto: form.texto.trim(),
      });
      await fetchDiario();
      setForm({ data: today(), tipo: 'anotacao', texto: '' });
    } catch {
      toast.error('Erro ao salvar entrada. Tente novamente.');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiarioEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
  };

  // Already returned sorted by API, but ensure desc anyway
  const sorted = [...entries].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Nova Entrada form */}
      <p className="section-label mb-3">Nova Entrada</p>
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            >
              {TIPO_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Observação</label>
          <textarea
            rows={3}
            placeholder="Descreva a observação..."
            value={form.texto}
            onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
            maxLength={1000}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 resize-none"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving || !form.texto.trim()}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: '#334155' }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
          Salvar
        </motion.button>
      </div>

      {/* Registros list */}
      <p className="section-label mb-3">Registros</p>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhum registro ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(entry => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#f1f5f9', color: '#475569' }}
                  >
                    {formatDatePtBR(entry.data)}
                  </span>
                  <TipoBadge tipo={entry.tipo} />
                </div>
                <p className="text-[13px] text-foreground leading-snug">{entry.texto}</p>
              </div>
              {canDelete && (
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleDelete(entry.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TabDiario;
