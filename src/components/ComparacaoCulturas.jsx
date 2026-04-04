import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material';
import { CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';

function CulturaRow({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  const defaults = {
    comprimento: cultura.canteiro.comprimento,
    largura: cultura.canteiro.largura,
    calcareo: cultura.insumos.calcareo.padrao,
    esterco: cultura.insumos.esterco.padrao,
    npk: cultura.insumos.npk.padrao,
    ureia: cultura.insumos.ureia.padrao,
    nitratoCalcio: cultura.insumos.nitratoCalcio.padrao,
    quantSementes: cultura.insumos.sementes.padrao,
    modObra: cultura.insumos.modObra.padrao,
    precoVenda: cultura.venda.precoUnitario,
    sobrevivencia: cultura.venda.sobrevivencia,
  };
  const valores = saved || defaults;
  const r = useSimulador(cultura, valores);

  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cultura.cor }} />
          <Typography fontWeight={700}>{cultura.nome}</Typography>
        </Box>
      </TableCell>
      <TableCell>{cultura.ciclo}</TableCell>
      <TableCell>{r.formatBRL(r.custoTotal)}</TableCell>
      <TableCell>{r.formatBRL(r.receita)}</TableCell>
      <TableCell sx={{ color: r.lucro >= 0 ? '#1e4d2b' : '#c0392b', fontWeight: 700 }}>{r.formatBRL(r.lucro)}</TableCell>
      <TableCell>
        <Chip
          label={`${r.margem.toFixed(1)}%`}
          size="small"
          sx={{
            bgcolor: r.margem >= 50 ? '#d8f3dc' : r.margem >= 20 ? '#fff8e1' : '#fde8e0',
            color: r.margem >= 50 ? '#1e4d2b' : r.margem >= 20 ? '#7b4f12' : '#c0392b',
            fontWeight: 700,
          }}
        />
      </TableCell>
    </TableRow>
  );
}

export default function ComparacaoCulturas() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 1, fontFamily: 'Fraunces, Georgia, serif' }}>Comparação entre Culturas</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Os valores refletem os parâmetros editados individualmente em cada simulador.
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Cultura</TableCell>
            <TableCell>Ciclo</TableCell>
            <TableCell>Custo/Canteiro</TableCell>
            <TableCell>Receita</TableCell>
            <TableCell>Lucro</TableCell>
            <TableCell>Margem</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {CULTURAS_LIST.map(c => <CulturaRow key={c.id} cultura={c} />)}
        </TableBody>
      </Table>
    </Box>
  );
}
