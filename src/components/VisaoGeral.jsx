import React from 'react';
import { Box, Typography, Grid, Chip, Divider } from '@mui/material';

const infoChips = (cultura) => [
  { label: `Solo: ${cultura.soloTipo}`, color: '#7b4f12' },
  { label: `pH: ${cultura.pH}`, color: '#1a6b9a' },
  { label: `Água: ${cultura.necessidadeHidrica}`, color: '#1e4d2b' },
  { label: `Clima: ${cultura.clima}`, color: '#b5451b' },
];

export default function VisaoGeral({ cultura }) {
  const area = cultura.canteiro.comprimento * cultura.canteiro.largura;
  const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
  const porLinha = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
  const totalPlantas = linhas * porLinha;
  const ha = 10000 / area;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e8e4de' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', letterSpacing: 0.5 }}>
          {cultura.nomesCientifico}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1.5, color: 'text.secondary', lineHeight: 1.7 }}>
          {cultura.descricao}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {infoChips(cultura).map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            size="small"
            sx={{ backgroundColor: c.color + '18', color: c.color, border: `1px solid ${c.color}40`, fontWeight: 600 }}
          />
        ))}
        <Chip label={`Ciclo: ${cultura.ciclo}`} size="small" variant="outlined" />
        <Chip label={`Espaçamento: ${cultura.espacamento}`} size="small" variant="outlined" />
      </Box>

      <Typography variant="h6" sx={{ mb: 2, fontFamily: 'Fraunces, Georgia, serif' }}>
        Dados do Canteiro Padrão
      </Typography>
      <Grid container spacing={2}>
        {[
          { label: 'Área', value: `${area} m²` },
          { label: 'Dimensões', value: `${cultura.canteiro.comprimento}×${cultura.canteiro.largura} m` },
          { label: 'Número de Plantas', value: totalPlantas.toLocaleString('pt-BR') },
          { label: 'Equivalente em Hectare', value: `~${ha.toFixed(0)} canteiros/ha` },
        ].map((item) => (
          <Grid item xs={6} md={3} key={item.label}>
            <Box sx={{
              p: 2,
              border: '1px solid #e8e4de',
              borderRadius: '6px',
              bgcolor: 'background.paper',
              textAlign: 'center',
            }}>
              <Typography variant="h5" sx={{ color: cultura.cor, fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700 }}>
                {item.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {item.label}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
