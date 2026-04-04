import { useMemo } from 'react';
import { ALERTAS } from '../data/alertas';

export function useAlertas(culturaId, campo, valor, params) {
  return useMemo(() => {
    const regras = ALERTAS[culturaId]?.[campo];
    if (!regras || valor === undefined || valor === null || valor === '') return null;
    const v = parseFloat(valor);
    if (isNaN(v)) return null;
    for (const regra of regras) {
      if (regra.condicao(v, params || {})) {
        return { nivel: regra.nivel, msg: regra.msg };
      }
    }
    return null;
  }, [culturaId, campo, valor, params]);
}
