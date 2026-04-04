import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Plus, Printer, Trash2, CheckCircle2, Circle } from 'lucide-react';

const TIPO_META = {
  plantio:  { color: '#059669', bg: '#ecfdf5', label: 'Plantio' },
  adubo:    { color: '#d97706', bg: '#fffbeb', label: 'Adubação' },
  foliar:   { color: '#2563eb', bg: '#eff6ff', label: 'Foliar' },
  colheita: { color: '#dc2626', bg: '#fef2f2', label: 'Colheita' },
  manejo:   { color: '#7c3aed', bg: '#f5f3ff', label: 'Manejo' },
  especial: { color: '#db2777', bg: '#fdf2f8', label: 'Especial' },
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

  const [status, setStatus]     = useState(() => { try { return JSON.parse(localStorage.getItem(statusKey)) || {}; } catch { return {}; } });
  const [customRows, setCustomRows] = useState(() => { try { return JSON.parse(localStorage.getItem(customKey)) || []; } catch { return []; } });

  const [confirmDialog, setConfirmDialog] = useState({ open: false, idx: null, etapa: '' });
  const [undoDialog,    setUndoDialog]    = useState({ open: false, idx: null, etapa: '' });
  const [addDialog,     setAddDialog]     = useState(false);
  const [confirmDate,   setConfirmDate]   = useState(todayISO());
  const [confirmObs,    setConfirmObs]    = useState('');
  const [newRow, setNewRow] = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });

  useEffect(() => { localStorage.setItem(statusKey, JSON.stringify(status)); }, [statusKey, status]);
  useEffect(() => { localStorage.setItem(customKey, JSON.stringify(customRows)); }, [customKey, customRows]);

  const allEvents = [
    ...cultura.cronograma.map((e, i) => ({ ...e, _id: `default_${i}`, _custom: false })),
    ...customRows.map((e, i)         => ({ ...e, _id: `custom_${i}`,  _custom: true })),
  ].sort((a, b) => a.dia - b.dia);

  const feitos   = allEvents.filter(e => status[e._id]?.status === 'feito').length;
  const progress = allEvents.length > 0 ? feitos / allEvents.length : 0;

  const handleChipClick = (id, etapa, st) => {
    if (st === 'feito') setUndoDialog({ open: true, idx: id, etapa });
    else { setConfirmDate(todayISO()); setConfirmObs(''); setConfirmDialog({ open: true, idx: id, etapa }); }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">Cronograma</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-semibold" style={{ color: cultura.cor }}>{feitos}</span> de {allEvents.length} etapas concluídas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}><Plus size={13} /> Adicionar</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={13} /></Button>
        </div>
      </div>

      {/* Progress */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] text-gray-400 font-medium">Progresso do ciclo</span>
            <span className="text-[11px] font-bold mono" style={{ color: cultura.cor }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${cultura.cor}80, ${cultura.cor})` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="stat-num text-2xl" style={{ color: cultura.cor }}>{feitos}</div>
          <div className="text-[9px] text-gray-400 uppercase tracking-widest">feitas</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[19px] top-5 pointer-events-none"
          style={{
            bottom: 0,
            width: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 100%)',
            borderRadius: 2,
          }}
        />

        <motion.div
          className="space-y-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {allEvents.map((ev, rowIdx) => {
            const st     = status[ev._id];
            const isDone = st?.status === 'feito';
            const meta   = TIPO_META[ev.tipo] || TIPO_META.manejo;
            const cidx   = ev._custom ? customRows.findIndex((_, i) => `custom_${i}` === ev._id) : -1;

            return (
              <motion.div
                key={ev._id}
                variants={{
                  hidden:   { opacity: 0, x: -12 },
                  visible:  { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
                }}
                className="relative pl-12"
              >
                {/* Timeline dot */}
                <motion.div
                  className="absolute left-[11px] top-4 w-[17px] h-[17px] rounded-full flex items-center justify-center z-10"
                  style={{
                    background: isDone ? meta.color : '#fff',
                    border: `2px solid ${isDone ? meta.color : 'rgba(0,0,0,0.1)'}`,
                    boxShadow: isDone ? `0 0 0 3px ${meta.color}20` : 'none',
                  }}
                  animate={{ scale: isDone ? 1.1 : 1 }}
                >
                  {isDone && <CheckCircle2 size={9} color="#fff" />}
                </motion.div>

                {/* Day */}
                <div className="absolute left-0 top-[17px] w-9 text-right">
                  <span className="text-[8px] font-bold text-gray-300 mono">D{ev.dia}</span>
                </div>

                {/* Card */}
                <motion.div
                  className="card overflow-hidden"
                  style={{ opacity: isDone ? 0.6 : 1 }}
                  whileHover={{ y: -1, boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.1)' }}
                >
                  {/* Color top strip */}
                  <div className="h-0.5 w-full" style={{ background: meta.color }} />

                  <div className="px-4 py-3 flex items-start gap-3">
                    {/* Type badge */}
                    <span
                      className="text-[9px] font-bold uppercase tracking-[1.5px] px-2 py-1 rounded-md flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-semibold leading-tight mb-0.5 ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {ev.etapa}
                      </div>
                      {ev.produto && ev.produto !== '—' && (
                        <div className="text-[11px] text-gray-500">
                          {ev.produto}{ev.dose && ev.dose !== '—' ? <> · <span className="font-semibold text-gray-700">{ev.dose}</span></> : ''}
                        </div>
                      )}
                      {ev.forma && ev.forma !== '—' && (
                        <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{ev.forma}</div>
                      )}
                      {isDone && st?.data && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <CheckCircle2 size={10} style={{ color: meta.color }} />
                          <span className="text-[10px] font-medium" style={{ color: meta.color }}>
                            {formatDate(st.data)}{st.obs ? ` · ${st.obs}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.93 }}
                        onClick={() => handleChipClick(ev._id, ev.etapa, st?.status)}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                        style={isDone
                          ? { background: meta.bg, color: meta.color }
                          : { background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }}
                      >
                        {isDone ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                        {isDone ? 'Feito' : 'Pendente'}
                      </motion.button>
                      {ev._custom && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCustomRows(r => r.filter((_, i) => i !== cidx))}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={12} />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* DIALOGS */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => !o && setConfirmDialog({ open: false, idx: null, etapa: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar execução</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 mb-3">
            Etapa: <strong className="text-gray-800">{confirmDialog.etapa}</strong>
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>Data de execução</Label>
              <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Observação (opcional)</Label>
              <textarea value={confirmObs} onChange={e => setConfirmObs(e.target.value)}
                placeholder="Ex: Aplicado às 6h..." rows={2}
                className="flex w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button onClick={() => { setStatus(s => ({ ...s, [confirmDialog.idx]: { status: 'feito', data: confirmDate, obs: confirmObs } })); setConfirmDialog({ open: false, idx: null, etapa: '' }); }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={undoDialog.open} onOpenChange={(o) => !o && setUndoDialog({ open: false, idx: null, etapa: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Desfazer?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Remove conclusão de <strong>{undoDialog.etapa}</strong>.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { setStatus(s => { const n = { ...s }; delete n[undoDialog.idx]; return n; }); setUndoDialog({ open: false, idx: null, etapa: '' }); }}>Desfazer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialog} onOpenChange={o => !o && setAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova etapa</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24"><Label>Dia</Label>
                <Input type="number" value={newRow.dia} onChange={e => setNewRow(r => ({ ...r, dia: e.target.value }))} /></div>
              <div className="flex flex-col gap-1 flex-1"><Label>Tipo</Label>
                <Select value={newRow.tipo} onValueChange={v => setNewRow(r => ({ ...r, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_META[t].label}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="flex flex-col gap-1"><Label>Etapa *</Label>
              <Input value={newRow.etapa} onChange={e => setNewRow(r => ({ ...r, etapa: e.target.value }))} /></div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1"><Label>Produto</Label>
                <Input value={newRow.produto} onChange={e => setNewRow(r => ({ ...r, produto: e.target.value }))} /></div>
              <div className="flex flex-col gap-1 w-28"><Label>Dose</Label>
                <Input value={newRow.dose} onChange={e => setNewRow(r => ({ ...r, dose: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-1"><Label>Forma de aplicação</Label>
              <textarea value={newRow.forma} onChange={e => setNewRow(r => ({ ...r, forma: e.target.value }))} rows={2}
                className="flex w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 resize-none" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button onClick={() => { if (!newRow.etapa) return; setCustomRows(r => [...r, { ...newRow, dia: parseInt(newRow.dia) || 0 }]); setNewRow({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' }); setAddDialog(false); }} disabled={!newRow.etapa}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
