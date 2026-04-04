import React, { useState, useCallback, useEffect } from 'react';
import { Box, Grid, Typography, TextField, InputAdornment, Button, Divider } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InsumoField from './InsumoField';
import ResultadoPanel from './ResultadoPanel';
import { useSimulador } from '../hooks/useSimulador';

const loadFromStorage = (key, def) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch { return def; }
};

export default function SimuladorFinanceiro({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  const ins = cultura.insumos;

  const getDefaults = useCallback(() => ({
    comprimento: cultura.canteiro.comprimento,
    largura: cultura.canteiro.largura,
    calcareo: ins.calcareo.padrao,
    esterco: ins.esterco.padrao,
    npk: ins.npk.padrao,
    ureia: ins.ureia.padrao,
    nitratoCalcio: ins.nitratoCalcio.padrao,
    quantSementes: ins.sementes.padrao,
    modObra: ins.modObra.padrao,
    precoVenda: cultura.venda.precoUnitario,
    sobrevivencia: cultura.venda.sobrevivencia,
  }), [cultura]);

  const [valores, setValores] = useState(() => loadFromStorage(storageKey, getDefaults()));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(valores));
  }, [storageKey, valores]);

  const handleChange = useCallback((campo, val) => {
    setValores(v => ({ ...v, [campo]: val }));
  }, []);

  const resetAll = () => setValores(getDefaults());

  const resultado = useSimulador(cultura, valores);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontFamily: 'Fraunces, Georgia, serif' }}>Simulador Financeiro</Typography>
        <Button startIcon={<RestartAltIcon />} onClick={resetAll} size="small" variant="outlined" color="secondary">
          Restaurar padrões
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
            Canteiro
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <TextField label="Comprimento" type="number" value={valores.comprimento} size="small" sx={{ width: 160 }}
              onChange={e => handleChange('comprimento', parseFloat(e.target.value) || 0)}
              InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
            <TextField label="Largura" type="number" value={valores.largura} size="small" sx={{ width: 160 }}
              onChange={e => handleChange('largura', parseFloat(e.target.value) || 0)}
              InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
          </Box>

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
            Insumos
          </Typography>

          <InsumoField label="Calcário" campo="calcareo" culturaId={cultura.id} valor={valores.calcareo} valorPadrao={ins.calcareo.padrao} params={ins.calcareo} unidade="kg" onChange={handleChange} />
          <InsumoField label="Esterco bovino" campo="esterco" culturaId={cultura.id} valor={valores.esterco} valorPadrao={ins.esterco.padrao} params={ins.esterco} unidade="kg" onChange={handleChange} />
          <InsumoField label={`NPK ${ins.npk.formula}`} campo="npk" culturaId={cultura.id} valor={valores.npk} valorPadrao={ins.npk.padrao} params={ins.npk} unidade="kg" onChange={handleChange} />
          <InsumoField label="Ureia 46%" campo="ureia" culturaId={cultura.id} valor={valores.ureia} valorPadrao={ins.ureia.padrao} params={ins.ureia} unidade={ins.ureia.unidade} onChange={handleChange} />
          <InsumoField label="Nitrato de Cálcio" campo="nitratoCalcio" culturaId={cultura.id} valor={valores.nitratoCalcio} valorPadrao={ins.nitratoCalcio.padrao} params={ins.nitratoCalcio} unidade="g" onChange={handleChange} />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
            Venda
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="Preço de venda" type="number" value={valores.precoVenda} size="small" sx={{ width: 180 }}
              onChange={e => handleChange('precoVenda', parseFloat(e.target.value) || 0)}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
            <TextField label="Sobrevivência" type="number" value={valores.sobrevivencia} size="small" sx={{ width: 160 }}
              onChange={e => handleChange('sobrevivencia', parseFloat(e.target.value) || 90)}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            <TextField label="Mão de obra" type="number" value={valores.modObra} size="small" sx={{ width: 180 }}
              onChange={e => handleChange('modObra', parseFloat(e.target.value) || 0)}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 24 } }}>
            <ResultadoPanel resultado={resultado} cultura={cultura} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
