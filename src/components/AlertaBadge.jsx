import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const NIVEL_CONFIG = {
  warning: { color: 'warning', label: '↑ Atenção', Icon: WarningAmberIcon },
  error: { color: 'error', label: '⚠ Dose Crítica', Icon: ErrorOutlineIcon },
  info: { color: 'info', label: '↓ Abaixo do mínimo', Icon: InfoOutlinedIcon },
};

export default function AlertaBadge({ alerta }) {
  if (!alerta) return null;
  const config = NIVEL_CONFIG[alerta.nivel];
  if (!config) return null;
  return (
    <Tooltip title={alerta.msg} arrow placement="top">
      <Chip
        size="small"
        label={config.label}
        color={config.color}
        icon={<config.Icon style={{ fontSize: 14 }} />}
        sx={{ ml: 1, cursor: 'help', fontWeight: 700, fontSize: '0.7rem' }}
      />
    </Tooltip>
  );
}
