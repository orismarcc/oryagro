/**
 * TabProducao.jsx — Aba de Registro Diário de Produção
 *
 * Permite o agricultor registrar quanto colheu em cada dia,
 * com classificação de qualidade (A/B/C/descarte).
 * Gera gráfico de evolução da produção e métricas de performance.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { Plus, Trash2, TrendingUp, BarChart2, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  useProducaoRegistros,
  addProducaoRegistro,
  deleteProducaoRegistro,
  QUALIDADE_CONFIG,
} from '../../hooks/useProducaoRegistros';
import { today, fmtNumber } from './shared';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDateShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Tooltip customizado do gráfico ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-[11px]">
      <p className="font-bold text-foreground mb-1">{fmtDateShort(d.data)}</p>
      {d.kg > 0 ? (
        <>
          <p className="text-foreground font-semibold">{fmtNumber(d.kg)} kg total</p>
          {d.qualidadeA > 0 && <p style={{ color: QUALIDADE_CONFIG.A.color }}>Premium A: {fmtNumber(d.qualidadeA)} kg</p>}
          {d.qualidadeB > 0 && <p style={{ color: QUALIDADE_CONFIG.B.color }}>Comercial B: {fmtNumber(d.qualidadeB)} kg</p>}
          {d.qualidadeC > 0 && <p style={{ color: QUALIDADE_CONFIG.C.color }}>Baixa C: {fmtNumber(d.qualidadeC)} kg</p>}
          {d.descarte  > 0 && <p style={{ color: QUALIDADE_CONFIG.descarte.color }}>Descarte: {fmtNumber(d.descarte)} kg</p>}
        </>
      ) : (
        <p className="text-muted-foreground">Sem registro</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabProducao({ lote, cultura }) {
  const toast = useToast();
  const {
    registros, loading, totalKg, mediaKgDia, chartData,
    addRegistro, removeRegistro,
  } = useProducaoRegistros(lote.id);

  const cor = cultura?.cor ?? '#16a34a';

  // Formulário de novo registro
  const [form, setForm] = useState({
    data: today(),
    quantidade: '',
    unidade: 'kg',
    qualidade: 'A',
    observacao: '',
  });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) {
      toast.error('Informe a quantidade colhida.');
      return;
    }
    setSaving(true);
    try {
      await addRegistro(form);
      setForm({ data: today(), quantidade: '', unidade: 'kg', qualidade: 'A', observacao: '' });
      setShowForm(false);
      toast.success('Produção registrada!');
    } catch {
      toast.error('Erro ao salvar registro. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este registro?')) return;
    try {
      await removeRegistro(id);
    } catch {
      toast.error('Erro ao remover registro.');
    }
  };

  // Métricas dos últimos 30 dias
  const ultimos30 = chartData.filter(d => d.kg > 0);
  const totalUltimos30 = ultimos30.reduce((s, d) => s + d.kg, 0);
  const melhorDia = chartData.reduce((mx, d) => d.kg > mx.kg ? d : mx, { kg: 0 });

  // Distribuição de qualidade
  const totalA = registros.reduce((s, r) => r.qualidade === 'A' ? s + parseFloat(r.quantidade) : s, 0);
  const totalB = registros.reduce((s, r) => r.qualidade === 'B' ? s + parseFloat(r.quantidade) : s, 0);
  const pctA   = totalKg > 0 ? Math.round((totalA / totalKg) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: cor }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ── Métricas rápidas ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <div className="text-[18px] font-black leading-none" style={{ color: cor }}>
            {fmtNumber(totalKg)}
          </div>
          <div className="text-[9px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">
            kg total (90d)
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[18px] font-black leading-none" style={{ color: cor }}>
            {fmtNumber(mediaKgDia, 1)}
          </div>
          <div className="text-[9px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">
            kg/dia (média)
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[18px] font-black leading-none" style={{ color: cor }}>
            {pctA}%
          </div>
          <div className="text-[9px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">
            qualidade A
          </div>
        </div>
      </div>

      {/* ── Gráfico últimos 30 dias ── */}
      {chartData.some(d => d.kg > 0) ? (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} style={{ color: cor }} />
            <span className="text-[12px] font-bold text-foreground">Produção — últimos 30 dias</span>
            {melhorDia.kg > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                Melhor dia: <strong>{fmtNumber(melhorDia.kg)} kg</strong> em {fmtDateShort(melhorDia.data)}
              </span>
            )}
          </div>
          <div style={{ overflow: 'hidden', borderRadius: 8 }}>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id={`prod-grad-${lote.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={cor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={cor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 13% 93%)" vertical={false} />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 9, fill: 'hsl(150 8% 55%)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={fmtDateShort}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(150 8% 55%)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v > 0 ? `${v}kg` : ''}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="kg"
                  stroke={cor} strokeWidth={2}
                  fill={`url(#prod-grad-${lote.id})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Distribuição qualidade */}
          {totalKg > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {Object.entries(QUALIDADE_CONFIG).map(([q, cfg]) => {
                const qty = registros.reduce((s, r) => r.qualidade === q ? s + parseFloat(r.quantidade) : s, 0);
                if (qty === 0) return null;
                return (
                  <div key={q} className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} />
                    <span className="text-muted-foreground">{cfg.label}: </span>
                    <span className="font-semibold text-foreground">{fmtNumber(qty)} kg</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center">
          <BarChart2 size={28} className="mx-auto mb-2" style={{ color: `${cor}60` }} />
          <p className="text-[13px] font-semibold text-foreground">Sem registros ainda</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Registre a produção de cada colheita para ver o gráfico de evolução.
          </p>
        </div>
      )}

      {/* ── Botão + formulário de novo registro ── */}
      <div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-all"
          style={{
            background: showForm ? `${cor}10` : cor,
            color: showForm ? cor : 'white',
            border: showForm ? `1.5px solid ${cor}40` : 'none',
          }}
        >
          <Plus size={14} />
          {showForm ? 'Cancelar' : 'Registrar produção de hoje'}
        </button>

        <AnimatePresence>
          {showForm && (
            <motion.form
              onSubmit={handleSave}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
              className="mt-2"
            >
              <div className="card p-4 flex flex-col gap-3">
                {/* Data */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Data</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none bg-background"
                    style={{ borderColor: `${cor}40` }}
                  />
                </div>

                {/* Quantidade + unidade */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quantidade colhida</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number" min="0.01" step="0.01"
                      value={form.quantidade}
                      onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                      placeholder="0.00"
                      className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold outline-none bg-background"
                      style={{ borderColor: `${cor}40` }}
                      autoFocus
                    />
                    <select
                      value={form.unidade}
                      onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                      className="rounded-xl border px-2 py-2 text-sm outline-none bg-background"
                      style={{ borderColor: `${cor}40` }}
                    >
                      <option value="kg">kg</option>
                      <option value="caixas">caixas</option>
                      <option value="dúzias">dúzias</option>
                      <option value="unidades">unidades</option>
                      <option value="t">t</option>
                    </select>
                  </div>
                </div>

                {/* Qualidade */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Qualidade</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Object.entries(QUALIDADE_CONFIG).map(([q, cfg]) => (
                      <button
                        key={q} type="button"
                        onClick={() => setForm(f => ({ ...f, qualidade: q }))}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                        style={form.qualidade === q
                          ? { background: cfg.color, color: 'white' }
                          : { background: cfg.bg, color: cfg.color }
                        }
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observação */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Observação (opcional)</label>
                  <input
                    type="text"
                    value={form.observacao}
                    onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    placeholder="Ex: chuva durante colheita, lote menor..."
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none bg-background"
                    style={{ borderColor: `${cor}40` }}
                  />
                </div>

                <button
                  type="submit" disabled={saving}
                  className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: cor, color: 'white' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Salvando…' : 'Salvar registro'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* ── Histórico de registros ── */}
      {registros.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[12px] font-bold text-foreground">Histórico de registros</span>
          </div>
          <div className="divide-y divide-border">
            {registros.slice(0, 30).map(r => {
              const cfg = QUALIDADE_CONFIG[r.qualidade] ?? QUALIDADE_CONFIG.A;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {r.qualidade ?? 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-foreground">
                        {fmtNumber(parseFloat(r.quantidade))} {r.unidade}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </span>
                      {r.observacao && (
                        <span className="text-[10px] text-muted-foreground truncate">· {r.observacao}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
