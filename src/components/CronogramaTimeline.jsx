import React, { useState } from 'react';
import { Box, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow, Button, Popover, Paper } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';

const TIPO_COR = {
  plantio: '#1e4d2b',
  adubo: '#d4a017',
  foliar: '#1a6b9a',
  colheita: '#b5451b',
  manejo: '#52b788',
  especial: '#7b1fa2',
};

export default function CronogramaTimeline({ cultura }) {
  const [status, setStatus] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [popEvento, setPopEvento] = useState(null);

  const eventos = cultura.cronograma;
  const maxDia = Math.max(...eventos.map(e => e.dia));
  const minDia = 0;

  const pct = (dia) => ((dia - minDia) / (maxDia - minDia)) * 100;

  const toggleStatus = (i) => {
    setStatus(s => ({ ...s, [i]: s[i] === 'feito' ? 'pendente' : 'feito' }));
  };

  const handleClick = (event, ev) => {
    setAnchorEl(event.currentTarget);
    setPopEvento(ev);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Cronograma — {cultura.nome}
        </Typography>
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => window.print()} size="small">
          Exportar PDF
        </Button>
      </Box>

      {/* Timeline horizontal */}
      <Box sx={{ position: 'relative', mx: 2, mb: 5, display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ height: 4, bgcolor: '#e8e4de', borderRadius: 2, position: 'relative', mt: 5 }}>
          {eventos.map((ev, i) => (
            <Box
              key={i}
              sx={{ position: 'absolute', left: `${pct(ev.dia)}%`, transform: 'translateX(-50%)', top: -4 }}
            >
              <Box
                onClick={(e) => handleClick(e, ev)}
                sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: TIPO_COR[ev.tipo] || '#999',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  '&:hover': { transform: 'scale(1.4)' },
                  transition: 'transform 0.15s',
                  boxShadow: `0 0 0 2px ${TIPO_COR[ev.tipo] || '#999'}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute', top: 16, left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap', fontSize: '0.65rem',
                  color: 'text.secondary', maxWidth: 80, textAlign: 'center',
                }}
              >
                D{ev.dia}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Typography variant="caption" color="text.secondary">Dia 0</Typography>
          <Typography variant="caption" color="text.secondary">Dia {maxDia}</Typography>
        </Box>
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {popEvento && (
          <Paper sx={{ p: 2, maxWidth: 280, border: '1px solid #e8e4de' }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>{popEvento.etapa}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Produto: {popEvento.produto}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Dose: {popEvento.dose}</Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{popEvento.forma}</Typography>
          </Paper>
        )}
      </Popover>

      {/* Tabela */}
      <Table size="small" className="print-table">
        <TableHead>
          <TableRow>
            <TableCell>Etapa</TableCell>
            <TableCell>Dia</TableCell>
            <TableCell>Produto</TableCell>
            <TableCell>Dose</TableCell>
            <TableCell>Forma de Aplicação</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {eventos.map((ev, i) => (
            <TableRow key={i}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TIPO_COR[ev.tipo] || '#999', flexShrink: 0 }} />
                  {ev.etapa}
                </Box>
              </TableCell>
              <TableCell>D{ev.dia}</TableCell>
              <TableCell>{ev.produto}</TableCell>
              <TableCell>{ev.dose}</TableCell>
              <TableCell sx={{ maxWidth: 200, fontSize: '0.78rem' }}>{ev.forma}</TableCell>
              <TableCell>
                <Chip
                  label={status[i] === 'feito' ? 'Feito ✓' : 'Pendente'}
                  size="small"
                  onClick={() => toggleStatus(i)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: status[i] === 'feito' ? '#d8f3dc' : '#fff8e1',
                    color: status[i] === 'feito' ? '#1e4d2b' : '#7b4f12',
                    border: `1px solid ${status[i] === 'feito' ? '#52b78840' : '#d4a01740'}`,
                    fontWeight: 700,
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
