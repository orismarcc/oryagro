import React, { useState, useCallback, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import AlertaBadge from './AlertaBadge';
import { useAlertas } from '../hooks/useAlertas';
import { RotateCcw } from 'lucide-react';

export default function InsumoField({
  label, campo, culturaId, valor, valorPadrao, params, unidade, onChange,
  porM2, porHa, areaAtual, areaBase, isCampo,
}) {
  const [local, setLocal] = useState(valor ?? valorPadrao);
  const alerta = useAlertas(culturaId, campo, local, params);

  useEffect(() => {
    if (areaAtual != null && areaBase != null && areaBase > 0) {
      const fator = areaAtual / areaBase;
      let novoValor;
      if (isCampo && porHa != null) {
        novoValor = parseFloat((porHa * areaAtual).toFixed(3));
      } else if (!isCampo && porM2 != null) {
        novoValor = parseFloat((porM2 * areaAtual).toFixed(3));
      }
      if (novoValor != null) {
        setLocal(novoValor);
        onChange(campo, novoValor);
      }
    }
  }, [areaAtual]);

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setLocal(v);
    const t = setTimeout(() => onChange(campo, parseFloat(v) || 0), 300);
    return () => clearTimeout(t);
  }, [campo, onChange]);

  const handleReset = () => {
    setLocal(valorPadrao);
    onChange(campo, valorPadrao);
  };

  const hasError = alerta?.nivel === 'error';

  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex flex-col gap-1 flex-1 max-w-[280px]">
        <Label htmlFor={campo} className="normal-case text-xs text-gray-500 font-medium tracking-normal">
          {label}
        </Label>
        <div className="relative flex items-center">
          <Input
            id={campo}
            type="number"
            value={local}
            onChange={handleChange}
            className={hasError ? 'border-red-400 ring-red-200 focus:ring-red-300' : ''}
          />
          {unidade && (
            <span className="absolute right-3 text-xs text-gray-400 pointer-events-none">{unidade}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-4">
        <AlertaBadge alerta={alerta} showOk={true} />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleReset} className="h-7 w-7 text-gray-400 hover:text-gray-700">
                <RotateCcw size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restaurar valor padrão</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
