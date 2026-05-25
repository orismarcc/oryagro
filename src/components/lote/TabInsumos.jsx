import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CloudCheck } from 'lucide-react';
import { PRECOS_INSUMOS } from '../../data/precos';
import { updateLoteMaoObra, savePrecoInsumos, loadPrecoInsumos } from '../../hooks/useGestao';
import { safeLS, saveLS, calcScale, fmtBRL } from './shared';

function TabInsumos({ cultura, lote }) {
  const isCampo = cultura.tipo === 'campo';
  const ins = cultura.insumos;
  const scale = calcScale(cultura, lote);

  const PRECO_KEY = `lote_precos_${lote.id}`;

  const defaultPrecos = {
    calcareo:    PRECOS_INSUMOS.calcareo,
    esterco:     isCampo ? PRECOS_INSUMOS.estercoCampo : PRECOS_INSUMOS.estercoCanteiro,
    npk:         isCampo ? PRECOS_INSUMOS.npkCampo     : PRECOS_INSUMOS.npkCanteiro,
    ureia:       PRECOS_INSUMOS.ureia,
    nitratoCalcio: PRECOS_INSUMOS.nitratoCalcio,
    fte:         PRECOS_INSUMOS.fte,
    sementes:    ins.sementes?.precoUnitario ?? 0,
    modObra:     0,
  };

  const [precos, setPrecos] = useState(() => {
    const saved = safeLS(PRECO_KEY, {});
    return { ...defaultPrecos, ...saved };
  });
  const [syncedCloud, setSyncedCloud] = useState(false); // mostra ícone de cloud após salvar
  const precosDebounceRef = useRef(null);

  // Op#8: Carrega preços do Supabase no mount (cross-device sync).
  // Supabase ganha sobre localStorage quando há dados remotos.
  useEffect(() => {
    loadPrecoInsumos(lote.id).then(remote => {
      if (!remote) return;
      setPrecos(prev => {
        const merged = { ...defaultPrecos, ...prev, ...remote };
        saveLS(PRECO_KEY, merged);
        return merged;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote.id]);

  // Editable mão de obra state
  const [maoObraReal, setMaoObraReal] = useState(lote.mao_obra_total ?? 0);
  const [savingMaoObra, setSavingMaoObra] = useState(false);
  const maoObraDebounceRef = useRef(null);

  // Sync maoObraReal with lote prop changes
  useEffect(() => {
    setMaoObraReal(lote.mao_obra_total ?? 0);
  }, [lote.mao_obra_total]);

  const handleMaoObraChange = (value) => {
    const num = parseFloat(value) || 0;
    setMaoObraReal(num);

    if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    maoObraDebounceRef.current = setTimeout(async () => {
      setSavingMaoObra(true);
      try {
        await updateLoteMaoObra(lote.id, num);
      } catch (e) {
        // silently ignore — value still held in local state
      } finally {
        setSavingMaoObra(false);
      }
    }, 500);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    };
  }, []);

  // Cleanup debounce refs on unmount
  useEffect(() => {
    return () => {
      if (precosDebounceRef.current) clearTimeout(precosDebounceRef.current);
    };
  }, []);

  const updatePreco = useCallback((key, value) => {
    setPrecos(prev => {
      const next = { ...prev, [key]: parseFloat(value) || 0 };
      // Salva imediatamente no localStorage (feedback instantâneo offline)
      saveLS(PRECO_KEY, next);
      // Debounce de 800ms para salvar no Supabase (Op#8: cross-device sync)
      if (precosDebounceRef.current) clearTimeout(precosDebounceRef.current);
      precosDebounceRef.current = setTimeout(() => {
        savePrecoInsumos(lote.id, next).then(() => {
          setSyncedCloud(true);
          setTimeout(() => setSyncedCloud(false), 2000);
        });
      }, 800);
      return next;
    });
  }, [PRECO_KEY, lote.id]);

  const insumoItems = [
    { key: 'calcareo',      label: 'Calcário',                 padrao: ins.calcareo?.padrao ?? 0,      unit: ins.calcareo?.unidade ?? 'kg',      toKg: 1 },
    { key: 'esterco',       label: 'Esterco bovino',            padrao: ins.esterco?.padrao ?? 0,       unit: ins.esterco?.unidade ?? 'kg',       toKg: 1 },
    { key: 'npk',           label: `NPK ${ins.npk?.formula ?? ''}`, padrao: ins.npk?.padrao ?? 0,      unit: ins.npk?.unidade ?? 'kg',           toKg: 1 },
    { key: 'ureia',         label: 'Ureia 46%',                 padrao: ins.ureia?.padrao ?? 0,         unit: ins.ureia?.unidade ?? 'g',          toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'nitratoCalcio', label: 'Nitrato de Cálcio',         padrao: ins.nitratoCalcio?.padrao ?? 0, unit: ins.nitratoCalcio?.unidade ?? 'g',  toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'fte',           label: 'FTE BR-12',                  padrao: ins.fte?.padrao ?? 0,           unit: ins.fte?.unidade ?? 'g',            toKg: isCampo ? 1 : 1 / 1000 },
  ];

  const sementesQty   = (ins.sementes?.padrao ?? 0) * scale;
  const sementesCusto = sementesQty * (precos.sementes || ins.sementes?.precoUnitario || 0);

  // Use editable maoObraReal instead of calculated value
  let totalInsumos = maoObraReal + sementesCusto;
  insumoItems.forEach(item => {
    const qty = item.padrao * scale;
    totalInsumos += qty * item.toKg * (precos[item.key] ?? 0);
  });

  // Scale info display
  const scaleInfo = isCampo
    ? `${((parseFloat(lote.area_ha) || 1)).toFixed(2)} ha · fator ${scale.toFixed(2)}× do padrão`
    : `${(
        (parseFloat(lote.comprimento_m) || cultura.canteiro.comprimento) *
        (parseFloat(lote.largura_m) || cultura.canteiro.largura)
      ).toFixed(1)} m² · fator ${scale.toFixed(2)}× do padrão`;

  const cor = cultura.cor;

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <p className="section-label">Calculadora de Insumos</p>
        {syncedCloud && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <CloudCheck size={11} /> salvo
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground mb-4">
        Este lote: {scaleInfo}
      </p>

      {/* Insumos card */}
      <div className="card p-0 overflow-hidden mb-4">
        {insumoItems.map((item, idx) => {
          const scaledQty = Math.round(item.padrao * scale * 100) / 100;
          const custo = scaledQty * item.toKg * (precos[item.key] ?? 0);
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: idx < insumoItems.length - 1 ? '1px solid hsl(214 20% 91%)' : undefined }}
            >
              {/* Label + qty */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {scaledQty} {item.unit}
                </p>
              </div>

              {/* Price input */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">R$/kg</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precos[item.key] ?? ''}
                  onChange={e => updatePreco(item.key, e.target.value)}
                  className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
                  style={{ focusRingColor: cor }}
                />
              </div>

              {/* Cost */}
              <div className="text-right flex-shrink-0 w-20">
                <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(custo)}</p>
              </div>
            </div>
          );
        })}

        {/* Sementes row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: 'hsl(210 16% 97%)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Sementes</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(sementesQty * 100) / 100} {ins.sementes?.unidade ?? 'un'}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">R$/un</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precos.sementes ?? ''}
              onChange={e => updatePreco('sementes', e.target.value)}
              className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
            />
          </div>
          <div className="text-right flex-shrink-0 w-20">
            <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(sementesCusto)}</p>
          </div>
        </div>

        {/* Mão de obra row — editable, persisted to Supabase */}
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: 'hsl(210 16% 97%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[13px] font-semibold text-foreground">Mão de obra real</p>
                {savingMaoObra && (
                  <Loader2 size={11} className="animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Valor real para este ciclo</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maoObraReal === 0 ? '' : maoObraReal}
                placeholder="0,00"
                onChange={e => handleMaoObraChange(e.target.value)}
                className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': cor }}
              />
            </div>
            <div className="text-right flex-shrink-0 w-20">
              <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(maoObraReal)}</p>
            </div>
          </div>
        </div>

        {/* Footer total */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `2px solid ${cor}30`, background: `${cor}08` }}
        >
          <p className="text-[13px] font-bold text-foreground">Total insumos</p>
          <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalInsumos)}</p>
        </div>
      </div>
    </div>
  );
}

export default TabInsumos;
