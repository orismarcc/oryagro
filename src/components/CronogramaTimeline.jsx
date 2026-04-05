import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Plus, Printer, Trash2, CheckCircle2, Circle, ChevronRight, CalendarDays, X } from 'lucide-react';

const TIPO_META = {
  plantio:  { color: '#059669', bg: 'hsl(152 69% 93%)', label: 'Plantio',   emoji: '🌱' },
  adubo:    { color: '#d97706', bg: 'hsl(43 96% 93%)',  label: 'Adubação',  emoji: '🧪' },
  foliar:   { color: '#2563eb', bg: 'hsl(221 90% 95%)', label: 'Foliar',    emoji: '💧' },
  colheita: { color: '#dc2626', bg: 'hsl(4 80% 94%)',   label: 'Colheita',  emoji: '🌾' },
  manejo:   { color: '#7c3aed', bg: 'hsl(263 80% 95%)', label: 'Manejo',    emoji: '🔧' },
  especial: { color: '#db2777', bg: 'hsl(322 75% 95%)', label: 'Especial',  emoji: '⭐' },
};
const TIPOS = Object.keys(TIPO_META);

const todayISO = () => new Date().toISOString().split('T')[0];
const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function CronogramaTimeline({ cultura }) {
  const statusKey = `cronograma_status_${cultura.id}`;
  const customKey  = `cronograma_custom_${cultura.id}`;

  const [status, setStatus]         = useState(() => { try { return JSON.parse(localStorage.getItem(statusKey)) || {}; } catch { return {}; } });
  const [customRows, setCustomRows] = useState(() => { try { return JSON.parse(localStorage.getItem(customKey)) || []; } catch { return []; } });

  // Inline confirm state (replaces dialog)
  const [confirming, setConfirming] = useState(null); // { id, etapa }
  const [confirmDate, setConfirmDate] = useState(todayISO());

  const [addDialog, setAddDialog] = useState(false);
  const [newRow, setNewRow] = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });

  useEffect(() => { localStorage.setItem(statusKey, JSON.stringify(status)); }, [statusKey, status]);
  useEffect(() => { localStorage.setItem(customKey, JSON.stringify(customRows)); }, [customKey, customRows]);

  const allEvents = [
    ...cultura.cronograma.map((e, i) => ({ ...e, _id: `default_${i}`, _custom: false })),
    ...customRows.map((e, i)         => ({ ...e, _id: `custom_${i}`,  _custom: true })),
  ].sort((a, b) => a.dia - b.dia);

  const feitos   = allEvents.filter(e => status[e._id]?.status === 'feito').length;
  const progress = allEvents.length > 0 ? feitos / allEvents.length : 0;
  const cor = cultura.cor;

  const confirmStep = (id) => {
    setStatus(s => ({ ...s, [id]: { status: 'feito', data: confirmDate } }));
    setConfirming(null);
  };

  const undoStep = (id) => {
    setStatus(s => { const n = { ...s }; delete n[id]; return n; });
  };

  return (
    <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Cronograma</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            <span className="font-bold" style={{ color: cor }}>{feitos}</span> de {allEvents.length} etapas concluídas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}>
            <Plus size={13} /> Adicionar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={13} />
          </Button>
        </div>
      </div>

      {/* ── Progress card ── */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-[11px] text-muted-foreground font-medium">Progresso do ciclo</span>
              <span className="text-[11px] font-bold" style={{ color: cor }}>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cor}80, ${cor})` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-3xl font-black leading-none" style={{ color: cor }}>{feitos}</div>
            <div className="section-label mt-0.5">feitas</div>
          </div>
        </div>
      </div>

      {/* ── Vertical Timeline ── */}
      <div className="flex flex-col">
        {allEvents.map((ev, rowIdx) => {
          const st     = status[ev._id];
          const isDone = st?.status === 'feito';
          const meta   = TIPO_META[ev.tipo] || TIPO_META.manejo;
          const cidx   = ev._custom ? customRows.findIndex((_, i) => `custom_${i}` === ev._id) : -1;
          const isLast = rowIdx === allEvents.length - 1;
          const isConfirming = confirming?.id === ev._id;

          return (
            <motion.div
              key={ev._id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rowIdx * 0.045, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-3"
            >
              {/* ── Left: day + connector ── */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 48 }}>
                <div
                  className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border"
                  style={isDone
                    ? { background: meta.color, borderColor: meta.color, boxShadow: `0 4px 12px ${meta.color}40` }
                    : { background: meta.bg, borderColor: `${meta.color}30` }
                  }
                >
                  {isDone
                    ? <CheckCircle2 size={20} color="#fff" />
                    : <>
                        <span className="text-[8px] font-black uppercase tracking-widest leading-none" style={{ color: meta.color }}>DIA</span>
                        <span className="font-display font-black text-sm leading-none mt-0.5" style={{ color: meta.color }}>{ev.dia}</span>
                      </>
                  }
                </div>
                {!isLast && (
                  <div className="w-0.5 flex-1 mt-1 mb-1 min-h-[20px]"
                    style={{ background: isDone ? `${meta.color}50` : 'hsl(214 20% 88%)' }} />
                )}
              </div>

              {/* ── Right: card ── */}
              <div className={`flex-1 ${!isLast ? 'mb-3' : ''}`}>
                <div
                  className="rounded-2xl overflow-hidden border"
                  style={{
                    borderColor: isDone ? `${meta.color}35` : isConfirming ? `${meta.color}60` : 'hsl(214 20% 88%)',
                    background: isDone ? meta.bg : '#fff',
                    boxShadow: isDone ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Card content */}
                  <div className="px-4 pt-3.5 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                        style={{ background: isDone ? `${meta.color}20` : meta.bg, color: meta.color }}
                      >
                        <span>{meta.emoji}</span>
                        {meta.label}
                      </span>
                      {ev._custom && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCustomRows(r => r.filter((_, i) => i !== cidx))}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </motion.button>
                      )}
                    </div>

                    <p className={`text-[14px] font-bold leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {ev.etapa}
                    </p>

                    {ev.produto && ev.produto !== '—' && (
                      <p className="text-[12px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <span>{ev.produto}</span>
                        {ev.dose && ev.dose !== '—' && (
                          <><span className="opacity-40">·</span><span className="font-semibold text-foreground">{ev.dose}</span></>
                        )}
                      </p>
                    )}

                    {ev.forma && ev.forma !== '—' && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{ev.forma}</p>
                    )}
                  </div>

                  {/* ── Done: date badge strip ── */}
                  {isDone && st?.data && (
                    <div
                      className="px-4 py-2 flex items-center justify-between"
                      style={{ background: `${meta.color}12`, borderTop: `1px solid ${meta.color}25` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={13} style={{ color: meta.color }} />
                        <span className="text-[13px] font-bold" style={{ color: meta.color }}>
                          {formatDate(st.data)}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground ml-1">concluído</span>
                      </div>
                      <button
                        onClick={() => undoStep(ev._id)}
                        className="text-[10px] font-semibold flex items-center gap-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X size={10} /> desfazer
                      </button>
                    </div>
                  )}

                  {/* ── Inline confirm form ── */}
                  <AnimatePresence>
                    {isConfirming && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className="px-4 py-3 flex flex-col gap-3"
                          style={{ background: `${meta.color}08`, borderTop: `1px solid ${meta.color}25` }}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarDays size={13} style={{ color: meta.color }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                              Data de execução
                            </span>
                          </div>
                          <input
                            type="date"
                            value={confirmDate}
                            onChange={e => setConfirmDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm font-semibold text-foreground bg-white focus:outline-none"
                            style={{ borderColor: `${meta.color}40` }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirming(null)}
                              className="flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors"
                              style={{ borderColor: 'hsl(214 20% 88%)', color: 'hsl(215 16% 45%)' }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => confirmStep(ev._id)}
                              className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white transition-colors"
                              style={{ background: meta.color }}
                            >
                              ✓ Confirmar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── CTA button (only when not done and not confirming) ── */}
                  {!isDone && !isConfirming && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      onClick={() => { setConfirmDate(todayISO()); setConfirming({ id: ev._id, etapa: ev.etapa }); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold transition-colors"
                      style={{ background: 'hsl(210 16% 97%)', color: 'hsl(215 16% 42%)', borderTop: '1px solid hsl(214 20% 91%)' }}
                    >
                      <span className="flex items-center gap-2">
                        <Circle size={13} />
                        Marcar como concluído
                      </span>
                      <ChevronRight size={13} className="opacity-50" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Add Dialog ── */}
      <Dialog open={addDialog} onOpenChange={o => !o && setAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova etapa</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24">
                <Label>Dia</Label>
                <Input type="number" value={newRow.dia} onChange={e => setNewRow(r => ({ ...r, dia: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label>Tipo</Label>
                <Select value={newRow.tipo} onValueChange={v => setNewRow(r => ({ ...r, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_META[t].emoji} {TIPO_META[t].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Etapa *</Label>
              <Input value={newRow.etapa} onChange={e => setNewRow(r => ({ ...r, etapa: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <Label>Produto</Label>
                <Input value={newRow.produto} onChange={e => setNewRow(r => ({ ...r, produto: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <Label>Dose</Label>
                <Input value={newRow.dose} onChange={e => setNewRow(r => ({ ...r, dose: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Forma de aplicação</Label>
              <textarea
                value={newRow.forma}
                onChange={e => setNewRow(r => ({ ...r, forma: e.target.value }))}
                rows={2}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button
              disabled={!newRow.etapa}
              onClick={() => {
                if (!newRow.etapa) return;
                setCustomRows(r => [...r, { ...newRow, dia: parseInt(newRow.dia) || 0 }]);
                setNewRow({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });
                setAddDialog(false);
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
