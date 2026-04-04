import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow,
  Button, Popover, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const TIPO_COR = {
  plantio: '#1e4d2b', adubo: '#d4a017', foliar: '#1a6b9a',
  colheita: '#b5451b', manejo: '#52b788', especial: '#7b1fa2',
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
  const customKey = `cronograma_custom_${cultura.id}`;

  const [status, setStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem(statusKey)) || {}; } catch { return {}; }
  });
  const [customRows, setCustomRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(customKey)) || []; } catch { return []; }
  });

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState({ open: false, idx: null, etapa: '' });
  const [undoDialog, setUndoDialog] = useState({ open: false, idx: null, etapa: '' });
  const [addDialog, setAddDialog] = useState(false);
  const [confirmDate, setConfirmDate] = useState(todayISO());
  const [confirmObs, setConfirmObs] = useState('');
  const [newRow, setNewRow] = useState({ dia: '', etapa: '', produto: '', dose: '', forma: '', tipo: 'adubo' });

  // Popover
  const [anchorEl, setAnchorEl] = useState(null);
  const [popEvento, setPopEvento] = useState(null);

  useEffect(() => { localStorage.setItem(statusKey, JSON.stringify(status)); }, [statusKey, status]);
  useEffect(() => { localStorage.setItem(customKey, JSON.stringify(customRows)); }, [customKey, customRows]);

  // Merge and sort all events
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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Cronograma — {cultura.nome}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setAddDialog(true)} size="small">
            Adicionar etapa
          </Button>
          <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => window.print()} size="small">
            Exportar PDF
          </Button>
        </Box>
      </Box>

      {/* Timeline horizontal */}
      <Box sx={{ position: 'relative', mx: 2, mb: 5, display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ height: 4, bgcolor: '#e8e4de', borderRadius: 2, position: 'relative', mt: 5 }}>
          {allEvents.map((ev) => {
            const pct = maxDia > 0 ? (ev.dia / maxDia) * 100 : 0;
            const st = status[ev._id];
            return (
              <Box key={ev._id} sx={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', top: -4 }}>
                <Box
                  onClick={(e) => { setAnchorEl(e.currentTarget); setPopEvento(ev); }}
                  sx={{
                    width: 12, height: 12, borderRadius: '50%',
                    bgcolor: st ? '#2d6a4f' : (TIPO_COR[ev.tipo] || '#999'),
                    border: '2px solid #fff', cursor: 'pointer',
                    transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.4)' },
                    boxShadow: `0 0 0 2px ${st ? '#2d6a4f' : (TIPO_COR[ev.tipo] || '#999')}`,
                  }}
                />
                <Typography variant="caption" sx={{
                  position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap', fontSize: '0.62rem', color: 'text.secondary',
                }}>
                  D{ev.dia}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Typography variant="caption" color="text.secondary">Dia 0</Typography>
          <Typography variant="caption" color="text.secondary">Dia {maxDia}</Typography>
        </Box>
      </Box>

      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {popEvento && (
          <Paper sx={{ p: 2, maxWidth: 280, border: '1px solid #e8e4de' }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>{popEvento.etapa}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Produto: {popEvento.produto}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Dose: {popEvento.dose}</Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{popEvento.forma}</Typography>
          </Paper>
        )}
      </Popover>

      {/* TABLE */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Etapa</TableCell>
            <TableCell>Dia</TableCell>
            <TableCell>Produto</TableCell>
            <TableCell>Dose</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Forma de Aplicação</TableCell>
            <TableCell>Status</TableCell>
            <TableCell sx={{ width: 40 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allEvents.map((ev) => {
            const st = status[ev._id];
            const customIdx = ev._custom
              ? customRows.findIndex((_, i) => `custom_${i}` === ev._id)
              : -1;
            return (
              <TableRow key={ev._id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TIPO_COR[ev.tipo] || '#999', flexShrink: 0 }} />
                    {ev.etapa}
                  </Box>
                </TableCell>
                <TableCell>D{ev.dia}</TableCell>
                <TableCell>{ev.produto}</TableCell>
                <TableCell>{ev.dose}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 200, fontSize: '0.78rem' }}>
                  {ev.forma}
                </TableCell>
                <TableCell>
                  <Box>
                    <Chip
                      label={st ? 'Feito ✓' : 'Pendente'}
                      size="small"
                      onClick={() => handleChipClick(ev._id, ev.etapa, st?.status)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: st ? '#d8f3dc' : '#fff8e1',
                        color: st ? '#1e4d2b' : '#7b4f12',
                        border: `1px solid ${st ? '#52b78840' : '#d4a01740'}`,
                        fontWeight: 700,
                      }}
                    />
                    {st?.data && (
                      <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.3, fontSize: '0.65rem' }}>
                        {formatDate(st.data)}
                        {st.obs && ` · ${st.obs}`}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {ev._custom && (
                    <IconButton size="small" onClick={() => handleDeleteCustom(customIdx)} sx={{ color: '#ccc', '&:hover': { color: '#c0392b' } }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* CONFIRM DONE DIALOG */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, idx: null, etapa: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar execução</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Etapa: <strong>{confirmDialog.etapa}</strong>
          </Typography>
          <TextField
            label="Data de execução" type="date" value={confirmDate} fullWidth size="small"
            onChange={(e) => setConfirmDate(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ mb: 2 }}
          />
          <TextField
            label="Observação (opcional)" value={confirmObs} fullWidth size="small" multiline rows={2}
            onChange={(e) => setConfirmObs(e.target.value)}
            placeholder="Ex: Aplicado às 6h, após irrigação..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
          <Button onClick={handleConfirm} variant="contained" color="primary">Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* UNDO DIALOG */}
      <Dialog open={undoDialog.open} onClose={() => setUndoDialog({ open: false, idx: null, etapa: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Desfazer execução?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Isso irá remover o registro de conclusão da etapa <strong>{undoDialog.etapa}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUndoDialog({ open: false, idx: null, etapa: '' })}>Cancelar</Button>
          <Button onClick={handleUndo} variant="outlined" color="error">Desfazer</Button>
        </DialogActions>
      </Dialog>

      {/* ADD ROW DIALOG */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar etapa ao cronograma</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Dia" type="number" value={newRow.dia} size="small" sx={{ width: 100 }}
                onChange={(e) => setNewRow(r => ({ ...r, dia: e.target.value }))} />
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={newRow.tipo} label="Tipo" onChange={(e) => setNewRow(r => ({ ...r, tipo: e.target.value }))}>
                  {TIPOS.map(t => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <TextField label="Etapa *" value={newRow.etapa} size="small" fullWidth
              onChange={(e) => setNewRow(r => ({ ...r, etapa: e.target.value }))} />
            <TextField label="Produto" value={newRow.produto} size="small" fullWidth
              onChange={(e) => setNewRow(r => ({ ...r, produto: e.target.value }))} />
            <TextField label="Dose" value={newRow.dose} size="small" fullWidth
              onChange={(e) => setNewRow(r => ({ ...r, dose: e.target.value }))} />
            <TextField label="Forma de aplicação" value={newRow.forma} size="small" fullWidth multiline rows={2}
              onChange={(e) => setNewRow(r => ({ ...r, forma: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancelar</Button>
          <Button onClick={handleAddRow} variant="contained" disabled={!newRow.etapa}>Adicionar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
