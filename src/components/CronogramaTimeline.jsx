import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Plus, Printer, Trash2, CheckCircle2, Clock3, ChevronRight } from 'lucide-react';

const TIPO_META = {
  plantio:  { color: '#2d6a4f', bg: '#2d6a4f14', label: 'Plantio' },
  adubo:    { color: '#d4a017', bg: '#d4a01714', label: 'Adubação' },
  foliar:   { color: '#1a6b9a', bg: '#1a6b9a14', label: 'Foliar' },
  colheita: { color: '#b5451b', bg: '#b5451b14', label: 'Colheita' },
  manejo:   { color: '#52b788', bg: '#52b78814', label: 'Manejo' },
  especial: { color: '#7b1fa2', bg: '#7b1fa214', label: 'Especial' },
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

  const [status, setStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem(statusKey)) || {}; } catch { return {}; }
  });
  const [customRows, setCustomRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(customKey)) || []; } catch { return []; }
  });

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
    ...customRows.map((e, i)         => ({ ...e, _id: `custom_${i}`,  _custom: true  })),
  ].sort((a, b) => a.dia - b.dia);

  const feitos = allEvents.filter(e => status[e._id]?.status === 'feito').length;
  const progress = allEvents.length > 0 ? Math.round((feitos / allEvents.length) * 100) : 0;

  const handleChipClick = (id, etapa, st) => {
    if (st === 'feito') {
      setUndoDialog({ open: true, idx: id, etapa });
    } else {
      setConfirmDate(todayISO());
      setConfirmObs('');
      setConfirmDialog({ open: true, idx: id, etapa });
    }
  };

  const handleConfirm = () => {
    setStatus(s => ({ ...s, [confirmDialog.idx]: { status: 'feito', data: confirmDate, obs: confirmObs } }));
    setConfirmDialog({ open: false, idx: null, etapa: '' });
  };

  const handleUndo = () => {
    setStatus(s => { const n = { ...s }; delete n[undoDialog.idx]; return n; });
    setUndoDialog({ open: false, idx: null, etapa: '' });
  };

  const handleAddRow = () => {
    if (!newRow.etapa) return;
    setCustomRows(r => [...r, { ...newRow, dia: parseInt(newRow.dia) || 0 }]);
    setNewRow({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });
    setAddDialog(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900 leading-tight">
            Cronograma de Atividades
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {feitos} de {allEvents.length} etapas concluídas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}>
            <Plus size={13} /> Adicionar etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={13} /> Imprimir
          </Button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-7">
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-gray-400 font-medium">Progresso do ciclo</span>
          <span className="text-[11px] font-bold" style={{ color: cultura.cor }}>{progress}%</span>
        </div>
        <div className="h-2 bg-borda rounded-full overflow-hidden">
          <div
            className="metric-bar-fill"
            style={{
              '--bar-w': `${progress}%`,
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${cultura.cor}aa, ${cultura.cor})`,
            }}
          />
        </div>
      </div>

      {/* ── Vertical Timeline ── */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[30px] top-4 bottom-4 w-px"
          style={{ background: `linear-gradient(to bottom, ${cultura.cor}40, ${cultura.cor}10)` }}
        />

        <div className="space-y-3">
          {allEvents.map((ev, rowIdx) => {
            const st = status[ev._id];
            const isDone = st?.status === 'feito';
            const meta = TIPO_META[ev.tipo] || TIPO_META.manejo;
            const customIdx = ev._custom
              ? customRows.findIndex((_, i) => `custom_${i}` === ev._id)
              : -1;

            return (
              <div
                key={ev._id}
                className={`relative pl-[60px] anim-fade-up`}
                style={{ animationDelay: `${rowIdx * 30}ms` }}
              >
                {/* Dot on timeline */}
                <div
                  className="absolute left-[22px] top-4 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center z-10 transition-all duration-300"
                  style={{
                    background: isDone ? '#1e4d2b' : meta.color,
                    boxShadow: `0 0 0 3px ${isDone ? '#1e4d2b20' : meta.color + '20'}`,
                  }}
                >
                  {isDone && <CheckCircle2 size={8} color="white" />}
                </div>

                {/* Day label */}
                <div
                  className="absolute left-0 top-4 -translate-y-[3px] text-[9px] font-bold text-gray-300 w-[18px] text-right"
                  style={{ fontSize: 9 }}
                >
                  D{ev.dia}
                </div>

                {/* Card */}
                <div
                  className={`rounded-xl border transition-all duration-200 ${isDone ? 'opacity-70' : ''}`}
                  style={{
                    borderColor: isDone ? '#e8e4de' : `${meta.color}30`,
                    background: isDone ? '#fafaf8' : 'white',
                  }}
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Type badge */}
                    <span
                      className="text-[9px] font-bold uppercase tracking-[1.5px] px-2 py-1 rounded flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className={`text-[13px] font-semibold leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {ev.etapa}
                          </div>
                          {ev.produto && ev.produto !== '—' && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {ev.produto}
                              {ev.dose && ev.dose !== '—' && <> · <strong>{ev.dose}</strong></>}
                            </div>
                          )}
                          {ev.forma && ev.forma !== '—' && (
                            <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                              {ev.forma}
                            </div>
                          )}
                          {isDone && st?.data && (
                            <div className="flex items-center gap-1 mt-1">
                              <CheckCircle2 size={10} color="#1e4d2b" />
                              <span className="text-[10px] text-verde-700 font-medium">
                                {formatDate(st.data)}{st.obs ? ` · ${st.obs}` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleChipClick(ev._id, ev.etapa, st?.status)}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all duration-200"
                            style={isDone ? {
                              background: '#1e4d2b12',
                              color: '#1e4d2b',
                              borderColor: '#1e4d2b30',
                            } : {
                              background: meta.bg,
                              color: meta.color,
                              borderColor: `${meta.color}30`,
                            }}
                          >
                            {isDone ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}
                            {isDone ? 'Feito' : 'Pendente'}
                          </button>
                          {ev._custom && (
                            <button
                              onClick={() => setCustomRows(r => r.filter((_, i) => i !== customIdx))}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CONFIRM DONE DIALOG ── */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => !o && setConfirmDialog({ open: false, idx: null, etapa: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar execução</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-3">
            Etapa: <strong className="text-gray-800">{confirmDialog.etapa}</strong>
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>Data de execução</Label>
              <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Observação (opcional)</Label>
              <textarea value={confirmObs} onChange={(e) => setConfirmObs(e.target.value)}
                placeholder="Ex: Aplicado às 6h, após irrigação..." rows={2}
                className="flex w-full rounded border border-borda bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-800 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UNDO DIALOG ── */}
      <Dialog open={undoDialog.open} onOpenChange={(o) => !o && setUndoDialog({ open: false, idx: null, etapa: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Desfazer execução?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            Remove o registro de conclusão de <strong className="text-gray-800">{undoDialog.etapa}</strong>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button variant="destructive" onClick={handleUndo}>Desfazer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD ROW DIALOG ── */}
      <Dialog open={addDialog} onOpenChange={(o) => !o && setAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar etapa</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24">
                <Label>Dia</Label>
                <Input type="number" value={newRow.dia} onChange={(e) => setNewRow(r => ({ ...r, dia: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label>Tipo</Label>
                <Select value={newRow.tipo} onValueChange={(v) => setNewRow(r => ({ ...r, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t} value={t}>
                        {TIPO_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Etapa *</Label>
              <Input value={newRow.etapa} onChange={(e) => setNewRow(r => ({ ...r, etapa: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <Label>Produto</Label>
                <Input value={newRow.produto} onChange={(e) => setNewRow(r => ({ ...r, produto: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <Label>Dose</Label>
                <Input value={newRow.dose} onChange={(e) => setNewRow(r => ({ ...r, dose: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Forma de aplicação</Label>
              <textarea value={newRow.forma} onChange={(e) => setNewRow(r => ({ ...r, forma: e.target.value }))} rows={2}
                className="flex w-full rounded border border-borda bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-800 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddRow} disabled={!newRow.etapa}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
