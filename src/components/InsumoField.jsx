import React, { useState, useCallback } from 'react';
import { Box, TextField, IconButton, Tooltip, InputAdornment } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AlertaBadge from './AlertaBadge';
import { useAlertas } from '../hooks/useAlertas';

export default function InsumoField({ label, campo, culturaId, valor, valorPadrao, params, unidade, onChange }) {
  const [local, setLocal] = useState(valor ?? valorPadrao);
  const alerta = useAlertas(culturaId, campo, local, params);

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setLocal(v);
    const timer = setTimeout(() => onChange(campo, parseFloat(v) || 0), 300);
    return () => clearTimeout(timer);
  }, [campo, onChange]);

  const handleReset = () => {
    setLocal(valorPadrao);
    onChange(campo, valorPadrao);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <TextField
        label={label}
        value={local}
        onChange={handleChange}
        type="number"
        sx={{
          width: 180,
          '& .MuiOutlinedInput-root fieldset': {
            borderColor: alerta?.nivel === 'error' ? '#c0392b' : undefined,
            borderWidth: alerta?.nivel === 'error' ? 2 : 1.5,
          },
        }}
        InputProps={{
          endAdornment: unidade ? <InputAdornment position="end">{unidade}</InputAdornment> : null,
        }}
      />
      <AlertaBadge alerta={alerta} />
      <Tooltip title="Restaurar valor padrão" arrow>
        <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
