import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Plus, Printer, Trash2 } from 'lucide-react';

const TIPO_COR = {
  plantio:  '#1e4d2b',
  adubo:    '#d4a017',
  foliar:   '#1a6b9a',
  colheita: '#b5451b',
  manejo:   '#52b788',
  especial: '#7b1fa2',
};

const TIPOS = ['plantio', 'adubo', 'foliar', 'colheita', 'manejo', 'especial'];

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
  const [undoDialog, setUndoDialog]       = useState({ open: false, idx: null, etapa: '' });
  const [addDialog, setAddDialog]         = useState(false);
  const [confirmDate, setConfirmDate]     = useState(todayISO());
  const [confirmObs, setConfirmObs]       = useState('');
  const [newRow, setNewRow]               = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });
  const [popEvento, setPopEvento]         = useState(null);
  const [popOpen, setPopOpen]             = useState(false);
  const [popAnchor, setPopAnchor]         = useState(null);

  useEffect(() => { localStorage.setItem(statusKey, JSON.stringify(status)); }, [statusKey, status]);
  useEffect(() => { localStorage.setItem(customKey, JSON.stringify(customRows)); }, [customKey, customRows]);

  const allEvents = [
    ...cultura.cronograma.map((e, i) => ({ ...e, _id: `default_${i}`, _custom: false })),
    ...customRows.map((e, i) => ({ ...e, _id: `custom_${i}`, _custom: true })),
  ].sort((a, b) => a.dia - b.dia);

  const maxDia = allEvents.length > 0 ? Math.max(...allEvents.map(e => e.dia)) : 1;

  const handleChipClick = (id, etapa, currentStatus) => {
    if (currentStatus === 'feito') {
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

  const handleDeleteCustom = (customIdx) => {
    setCustomRows(r => r.filter((_, i) => i !== customIdx));
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between mb-5 flex-wrap gap-2">
        <h2 className="font-display font-semibold text-lg text-gray-900">
          Cronograma — {cultura.nome}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}>
            <Plus size={14} />
            Adicionar etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={14} />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Timeline horizontal — hidden on mobile */}
      <div className="hidden md:block relative mx-4 mb-8">
        <div className="relative h-1 bg-borda rounded-full mt-8">
          {allEvents.map((ev) => {
            const pct = maxDia > 0 ? (ev.dia / maxDia) * 100 : 0;
            const st = status[ev._id];
            return (
              <div
                key={ev._id}
                className="absolute"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)', top: '-5px' }}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-3 h-3 rounded-full border-2 border-white cursor-pointer transition-transform hover:scale-150 focus:outline-none"
                      style={{
                        backgroundColor: st ? '#2d6a4f' : (TIPO_COR[ev.tipo] || '#999'),
                        boxShadow: `0 0 0 2px ${st ? '#2d6a4f' : (TIPO_COR[ev.tipo] || '#999')}`,
                      }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <p className="font-bold text-sm mb-1">{ev.etapa}</p>
                    <p className="text-xs text-gray-500">Produto: {ev.produto}</p>
                    <p className="text-xs text-gray-500">Dose: {ev.dose}</p>
                    <p className="text-xs text-gray-500 mt-1">{ev.forma}</p>
                  </PopoverContent>
                </Popover>
                <span
                  className="absolute whitespace-nowrap text-[0.62rem] text-gray-500"
                  style={{ top: '16px', left: '50%', transform: 'translateX(-50%)' }}
                >
                  D{ev.dia}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-6">
          <span className="text-xs text-gray-400">Dia 0</span>
          <span className="text-xs text-gray-400">Dia {maxDia}</span>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-verde-800 text-white text-xs">
              <th className="text-left px-3 py-2.5 rounded-tl">Etapa</th>
              <th className="text-left px-3 py-2.5">Dia</th>
              <th className="text-left px-3 py-2.5">Produto</th>
              <th className="text-left px-3 py-2.5">Dose</th>
              <th className="hidden md:table-cell text-left px-3 py-2.5">Forma de Aplicação</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 rounded-tr w-10"></th>
            </tr>
          </thead>
          <tbody>
            {allEvents.map((ev, rowIdx) => {
              const st = status[ev._id];
              const customIdx = ev._custom
                ? customRows.findIndex((_, i) => `custom_${i}` === ev._id)
                : -1;
              return (
                <tr key={ev._id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-papel'}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TIPO_COR[ev.tipo] || '#999' }}
                      />
                      <span className="font-medium">{ev.etapa}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">D{ev.dia}</td>
                  <td className="px-3 py-2.5">{ev.produto}</td>
                  <td className="px-3 py-2.5">{ev.dose}</td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-xs text-gray-600 max-w-[200px]">{ev.forma}</td>
                  <td className="px-3 py-2.5">
                    <div>
                      <button
                        onClick={() => handleChipClick(ev._id, ev.etapa, st?.status)}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border cursor-pointer transition-colors ${
                          st
                            ? 'bg-verde-100 text-verde-800 border-verde-400/30 hover:bg-verde-100'
                            : 'bg-dourado-100 text-terra-600 border-dourado-400/30 hover:bg-dourado-100'
                        }`}
                      >
                        {st ? 'Feito ✓' : 'Pendente'}
                      </button>
                      {st?.data && (
                        <div className="text-[0.65rem] text-gray-400 mt-0.5">
                          {formatDate(st.data)}{st.obs ? ` · ${st.obs}` : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {ev._custom && (
                      <button
                        onClick={() => handleDeleteCustom(customIdx)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CONFIRM DONE DIALOG */}
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
              <Label htmlFor="confDate">Data de execução</Label>
              <Input id="confDate" type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="confObs">Observação (opcional)</Label>
              <textarea
                id="confObs"
                value={confirmObs}
                onChange={(e) => setConfirmObs(e.target.value)}
                placeholder="Ex: Aplicado às 6h, após irrigação..."
                rows={2}
                className="flex w-full rounded border border-borda bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-800 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNDO DIALOG */}
      <Dialog open={undoDialog.open} onOpenChange={(o) => !o && setUndoDialog({ open: false, idx: null, etapa: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desfazer execução?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Isso irá remover o registro de conclusão da etapa <strong className="text-gray-800">{undoDialog.etapa}</strong>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
            <Button variant="destructive" onClick={handleUndo}>Desfazer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD ROW DIALOG */}
      <Dialog open={addDialog} onOpenChange={(o) => !o && setAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar etapa ao cronograma</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24">
                <Label htmlFor="newDia">Dia</Label>
                <Input id="newDia" type="number" value={newRow.dia}
                  onChange={(e) => setNewRow(r => ({ ...r, dia: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="newTipo">Tipo</Label>
                <Select value={newRow.tipo} onValueChange={(v) => setNewRow(r => ({ ...r, tipo: v }))}>
                  <SelectTrigger id="newTipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="newEtapa">Etapa *</Label>
              <Input id="newEtapa" value={newRow.etapa}
                onChange={(e) => setNewRow(r => ({ ...r, etapa: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="newProduto">Produto</Label>
              <Input id="newProduto" value={newRow.produto}
                onChange={(e) => setNewRow(r => ({ ...r, produto: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="newDose">Dose</Label>
              <Input id="newDose" value={newRow.dose}
                onChange={(e) => setNewRow(r => ({ ...r, dose: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="newForma">Forma de aplicação</Label>
              <textarea
                id="newForma"
                value={newRow.forma}
                onChange={(e) => setNewRow(r => ({ ...r, forma: e.target.value }))}
                rows={2}
                className="flex w-full rounded border border-borda bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-800 resize-none"
              />
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
