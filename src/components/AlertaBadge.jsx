import React from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

const CFG = {
  warning: { variant: 'warning', label: '↑ Atenção',         Icon: AlertTriangle },
  error:   { variant: 'error',   label: '⚠ Dose Crítica',    Icon: AlertCircle },
  info:    { variant: 'info',    label: '↓ Abaixo do mínimo', Icon: Info },
};

export default function AlertaBadge({ alerta, showOk = false }) {
  if (!alerta) {
    if (!showOk) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1.5"
        style={{ background: '#dcfce7', color: '#16a34a' }}>
        <CheckCircle2 size={10} /> OK
      </span>
    );
  }
  const cfg = CFG[alerta.nivel];
  if (!cfg) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={cfg.variant} className="cursor-help ml-1.5">
            <cfg.Icon size={11} />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{alerta.msg}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
