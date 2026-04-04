import React, { useState } from 'react';
import { Box, useMediaQuery, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';
import Sidebar from './components/Sidebar';
import CulturaPage from './components/CulturaPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS, CULTURAS_LIST } from './data/culturas';

export default function App() {
  const [selecionado, setSelecionado] = useState('alface');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleCultura = (id) => setSelecionado(id);
  const handleComparacao = () => setSelecionado('__comparacao__');

  const cultura = CULTURAS[selecionado];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {!isMobile && (
          <Sidebar culturaSelecionada={selecionado} onSelectCultura={handleCultura} onSelectComparacao={handleComparacao} />
        )}

        <Box sx={{ flex: 1, overflow: 'auto', pb: isMobile ? 7 : 0 }}>
          {selecionado === '__comparacao__' ? (
            <ComparacaoCulturas />
          ) : cultura ? (
            <CulturaPage cultura={cultura} />
          ) : null}
        </Box>

        {isMobile && (
          <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }} elevation={3}>
            <BottomNavigation
              value={CULTURAS_LIST.findIndex(c => c.id === selecionado)}
              onChange={(_, i) => {
                if (i < CULTURAS_LIST.length) setSelecionado(CULTURAS_LIST[i].id);
                else handleComparacao();
              }}
              showLabels
              sx={{ bgcolor: '#1e4d2b', '& .MuiBottomNavigationAction-label': { color: '#52b788', fontSize: '0.6rem' }, '& .Mui-selected': { '& .MuiBottomNavigationAction-label': { color: '#fff' } } }}
            >
              {CULTURAS_LIST.map(c => (
                <BottomNavigationAction key={c.id} label={c.nome.slice(0, 6)} sx={{ minWidth: 'auto', px: 0.5 }} />
              ))}
              <BottomNavigationAction label="Comparar" sx={{ minWidth: 'auto' }} />
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    </ThemeProvider>
  );
}
