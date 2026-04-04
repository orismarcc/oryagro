import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Grid, Typography, TextField, InputAdornment, Button, Divider,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InsumoField from './InsumoField';
import ResultadoPanel from './ResultadoPanel';
import { useSimulador, calcularPlantas } from '../hooks/useSimulador';

const loadFromStorage = (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
};

export default function SimuladorFinanceiro({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';

  const getDefaults = useCallback(() => {
    if (isCampo) {
      return {
        areaHa: cultura.area.padrao,
        espacamentoLinhas: cultura.espacamento.linhas,
        espacamentoPlantas: cultura.espacamento.plantas,
        calcareo: ins.calcareo.padrao,
        esterco: ins.esterco.padrao,
        npk: ins.npk.padrao,
        ureia: ins.ureia.padrao,
        nitratoCalcio: ins.nitratoCalcio.padrao,
        modObra: ins.modObra.padrao,
        precoVenda: cultura.venda.precoUnitario,
        sobrevivencia: cultura.venda.sobrevivencia,
      };
    }
    return {
      comprimento: cultura.canteiro.comprimento,
      largura: cultura.canteiro.largura,
      espacamentoLinhas: cultura.canteiro.espacamentoLinhas,
      espacamentoPlantas: cultura.canteiro.espacamentoPlantas,
      calcareo: ins.calcareo.padrao,
      esterco: ins.esterco.padrao,
      npk: ins.npk.padrao,
      ureia: ins.ureia.padrao,
      nitratoCalcio: ins.nitratoCalcio.padrao,
      modObra: ins.modObra.padrao,
      precoVenda: cultura.venda.precoUnitario,
      sobrevivencia: cultura.venda.sobrevivencia,
    };
  }, [cultura, isCampo, ins]);

  const [valores, setValores] = useState(() => loadFromStorage(storageKey, getDefaults()));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(valores));
  }, [storageKey, valores]);

  const handleChange = useCallback((campo, val) => {
    setValores(v => ({ ...v, [campo]: val }));
  }, []);

  const handleNum = (campo) => (e) => {
    const raw = e.target.value;
    setValores(prev => ({ ...prev, [campo]: raw === '' ? '' : parseFloat(raw) || 0 }));
  };

  const resetAll = () => setValores(getDefaults());
  const resultado = useSimulador(cultura, valores);
  const dim = calcularPlantas(cultura, valores);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Simulador Financeiro
          </Typography>
          {isCampo && (
            <Typography variant="caption" sx={{ color: '#b5451b', fontWeight: 700 }}>
              Cálculo por hectare
            </Typography>
          )}
        </Box>
        <Button startIcon={<RestartAltIcon />} onClick={resetAll} size="small" variant="outlined" color="secondary">
          Restaurar padrões
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>

          {/* DIMENSÕES */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
            {isCampo ? 'Área e Espaçamento' : 'Dimensões do Canteiro'}
          </Typography>

          {isCampo ? (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <TextField label="Área" type="number" value={valores.areaHa ?? ''} size="small" sx={{ width: 140 }}
                onChange={handleNum('areaHa')}
                InputProps={{ endAdornment: <InputAdornment position="end">ha</InputAdornment> }} />
              <TextField label="Espaç. entre linhas" type="number" value={valores.espacamentoLinhas ?? ''} size="small" sx={{ width: 185 }}
                onChange={handleNum('espacamentoLinhas')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
              <TextField label="Espaç. entre plantas" type="number" value={valores.espacamentoPlantas ?? ''} size="small" sx={{ width: 185 }}
                onChange={handleNum('espacamentoPlantas')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <TextField label="Comprimento" type="number" value={valores.comprimento ?? ''} size="small" sx={{ width: 145 }}
                onChange={handleNum('comprimento')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
              <TextField label="Largura" type="number" value={valores.largura ?? ''} size="small" sx={{ width: 130 }}
                onChange={handleNum('largura')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
              <TextField label="Espaç. linhas" type="number" value={valores.espacamentoLinhas ?? ''} size="small" sx={{ width: 150 }}
                onChange={handleNum('espacamentoLinhas')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
              <TextField label="Espaç. plantas" type="number" value={valores.espacamentoPlantas ?? ''} size="small" sx={{ width: 150 }}
                onChange={handleNum('espacamentoPlantas')}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} />
            </Box>
          )}

          {/* PLANTAS CALCULADAS — live */}
          <Box sx={{ p: 1.5, bgcolor: '#f7f5f0', border: '1px solid #e8e4de', borderRadius: '6px', mb: 2.5 }}>
            {isCampo ? (
              <>
                <Typography variant="caption" color="text.secondary" display="block">
                  {(dim.areaHa || 0).toLocaleString('pt-BR')} ha · espaçamento {(parseFloat(valores.espacamentoLinhas) || cultura.espacamento.linhas).toFixed(2)} × {(parseFloat(valores.espacamentoPlantas) || cultura.espacamento.plantas).toFixed(2)} m
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {(dim.plantasPorHa || 0).toLocaleString('pt-BR')} plantas/ha →{' '}
                  <span style={{ color: '#1e4d2b' }}>{(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas no total</span>
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" display="block">
                  {dim.comp || 0} × {dim.larg || 0} m = {(dim.area || 0).toFixed(1)} m² · espaçamento {(dim.spacingL || 0).toFixed(2)} × {(dim.spacingP || 0).toFixed(2)} m
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {dim.linhas || 0} fileiras × {dim.porLinha || 0} plantas ={' '}
                  <span style={{ color: '#1e4d2b' }}>{(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas/canteiro</span>
                </Typography>
              </>
            )}
          </Box>

          {/* INSUMOS */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
            Insumos {isCampo ? '(valores por ha)' : '(por canteiro)'}
          </Typography>

          <InsumoField label={`Calcário (${ins.calcareo.unidade})`} campo="calcareo" culturaId={cultura.id}
            valor={valores.calcareo} valorPadrao={ins.calcareo.padrao} params={ins.calcareo}
            unidade={ins.calcareo.unidade} onChange={handleChange} />
          <InsumoField label={`Esterco (${ins.esterco.unidade})`} campo="esterco" culturaId={cultura.id}
            valor={valores.esterco} valorPadrao={ins.esterco.padrao} params={ins.esterco}
            unidade={ins.esterco.unidade} onChange={handleChange} />
          <InsumoField label={`NPK ${ins.npk.formula} (${ins.npk.unidade})`} campo="npk" culturaId={cultura.id}
            valor={valores.npk} valorPadrao={ins.npk.padrao} params={ins.npk}
            unidade={ins.npk.unidade} onChange={handleChange} />
          <InsumoField label={`Ureia 46% (${ins.ureia.unidade})`} campo="ureia" culturaId={cultura.id}
            valor={valores.ureia} valorPadrao={ins.ureia.padrao} params={ins.ureia}
            unidade={ins.ureia.unidade} onChange={handleChange} />
          <InsumoField label={`Nitrato de Cálcio (${ins.nitratoCalcio.unidade})`} campo="nitratoCalcio" culturaId={cultura.id}
            valor={valores.nitratoCalcio} valorPadrao={ins.nitratoCalcio.padrao} params={ins.nitratoCalcio}
            unidade={ins.nitratoCalcio.unidade} onChange={handleChange} />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
            Venda e Mão de Obra
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label={`Preço / ${cultura.venda.unidade}`} type="number" value={valores.precoVenda ?? ''} size="small" sx={{ width: 175 }}
              onChange={handleNum('precoVenda')}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
            <TextField label="Sobrevivência" type="number" value={valores.sobrevivencia ?? ''} size="small" sx={{ width: 145 }}
              onChange={handleNum('sobrevivencia')}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            <TextField label={`Mão de obra${isCampo ? ' / ha' : ' / ciclo'}`} type="number" value={valores.modObra ?? ''} size="small" sx={{ width: 190 }}
              onChange={handleNum('modObra')}
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
