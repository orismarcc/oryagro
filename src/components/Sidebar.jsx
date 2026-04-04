import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText } from '@mui/material';
import { CULTURAS_LIST } from '../data/culturas';

const LeafSVG = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 3C8 3 4 9 4 14c0 5.5 4 9 10 9 6 0 10-4 10-10C24 7 20 3 14 3z" fill="#52b788" opacity="0.3"/>
    <path d="M14 3C20 3 24 8 24 13 C24 18 20 23 14 23" stroke="#1e4d2b" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M14 23 C8 23 4 18 4 13" stroke="#52b788" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="14" y1="23" x2="14" y2="10" stroke="#1e4d2b" strokeWidth="1" strokeDasharray="2 2"/>
  </svg>
);

const CulturaIcon = ({ cor }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" fill={cor} opacity="0.2" />
    <circle cx="10" cy="10" r="4" fill={cor} opacity="0.6" />
    <line x1="10" y1="18" x2="10" y2="12" stroke={cor} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="7" y1="15" x2="10" y2="12" stroke={cor} strokeWidth="1" strokeLinecap="round"/>
    <line x1="13" y1="14" x2="10" y2="12" stroke={cor} strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export default function Sidebar({ culturaSelecionada, onSelectCultura, onSelectComparacao }) {
  return (
    <Box sx={{
      width: 220,
      minHeight: '100vh',
      bgcolor: '#1e4d2b',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid #2d6a4f', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LeafSVG />
        <Box>
          <Typography sx={{ color: '#fff', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>
            Ory Agro
          </Typography>
          <Typography sx={{ color: '#52b788', fontSize: '0.65rem', letterSpacing: 1, textTransform: 'uppercase' }}>
            Guia Hortícola
          </Typography>
        </Box>
      </Box>

      {/* Menu Culturas */}
      <Box sx={{ p: 1.5, flex: 1 }}>
        <Typography sx={{ color: '#52b788', fontSize: '0.65rem', letterSpacing: 1.5, textTransform: 'uppercase', px: 1, mb: 1, fontWeight: 700 }}>
          Culturas
        </Typography>
        <List disablePadding>
          {CULTURAS_LIST.map(c => (
            <ListItemButton
              key={c.id}
              selected={culturaSelecionada === c.id}
              onClick={() => onSelectCultura(c.id)}
              sx={{
                borderRadius: '6px',
                mb: 0.5,
                px: 1.5,
                py: 1,
                '&.Mui-selected': { bgcolor: '#2d6a4f', '&:hover': { bgcolor: '#2d6a4f' } },
                '&:hover': { bgcolor: '#163820' },
              }}
            >
              <CulturaIcon cor={c.cor} />
              <ListItemText
                primary={c.nome}
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: '0.875rem', fontWeight: culturaSelecionada === c.id ? 700 : 400, ml: 1.5 } }}
              />
            </ListItemButton>
          ))}
        </List>

        <Box sx={{ mt: 2, borderTop: '1px solid #2d6a4f', pt: 1.5 }}>
          <Typography sx={{ color: '#52b788', fontSize: '0.65rem', letterSpacing: 1.5, textTransform: 'uppercase', px: 1, mb: 1, fontWeight: 700 }}>
            Análise
          </Typography>
          <ListItemButton
            selected={culturaSelecionada === '__comparacao__'}
            onClick={onSelectComparacao}
            sx={{
              borderRadius: '6px',
              px: 1.5, py: 1,
              '&.Mui-selected': { bgcolor: '#2d6a4f' },
              '&:hover': { bgcolor: '#163820' },
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="12" width="4" height="6" fill="#52b788" opacity="0.7" rx="1"/>
              <rect x="8" y="8" width="4" height="10" fill="#52b788" opacity="0.7" rx="1"/>
              <rect x="14" y="4" width="4" height="14" fill="#52b788" rx="1"/>
            </svg>
            <ListItemText
              primary="Comparar Culturas"
              primaryTypographyProps={{ sx: { color: '#fff', fontSize: '0.875rem', fontWeight: culturaSelecionada === '__comparacao__' ? 700 : 400, ml: 1.5 } }}
            />
          </ListItemButton>
        </Box>
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid #2d6a4f' }}>
        <Typography sx={{ color: '#2d6a4f', fontSize: '0.65rem', textAlign: 'center' }}>
          Ory Agro © 2025
        </Typography>
      </Box>
    </Box>
  );
}
