import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import VisaoGeral from './VisaoGeral';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import SimuladorFinanceiro from './SimuladorFinanceiro';

export default function CulturaPage({ cultura }) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{
        px: { xs: 2, md: 3 },
        py: 2.5,
        borderBottom: '1px solid #e8e4de',
        bgcolor: 'background.paper',
        background: `linear-gradient(135deg, ${cultura.cor}08 0%, transparent 60%)`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 6, height: 40, bgcolor: cultura.cor, borderRadius: 1 }} />
          <Box>
            <Box component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', fontStyle: 'italic', display: 'block' }}>
              {cultura.nomesCientifico}
            </Box>
            <Box component="span" sx={{ fontSize: '1.5rem', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700, color: 'text.primary' }}>
              {cultura.nome}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ borderBottom: '1px solid #e8e4de', bgcolor: 'background.paper' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, '& .MuiTabs-indicator': { bgcolor: cultura.cor, height: 3 } }}
        >
          {['Visão Geral', 'Manejo e Adubação', 'Cronograma', 'Simulador'].map((label, i) => (
            <Tab key={i} label={label} sx={{ '&.Mui-selected': { color: cultura.cor } }} />
          ))}
        </Tabs>
      </Box>

      <Box>
        {tab === 0 && <VisaoGeral cultura={cultura} />}
        {tab === 1 && <ManejoAdubacao cultura={cultura} />}
        {tab === 2 && <CronogramaTimeline cultura={cultura} />}
        {tab === 3 && <SimuladorFinanceiro cultura={cultura} />}
      </Box>
    </Box>
  );
}
