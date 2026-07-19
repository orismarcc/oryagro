import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator, Loader2 } from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { PRECOS_INSUMOS } from '../data/precos';
import { loadPropriedades, loadLotesByPropriedade } from '../hooks/useSupabaseSync';
import { updateLoteMaoObra } from '../hooks/useGestao';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(n) {
  if (n === undefined || n === null || isNaN(n)) return 'R$ —';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function calcScale(cultura, params) {
  if (cultura.tipo === 'campo') {
    const base = cultura.area?.padrao || 1;
    return (parseFloat(params.area_ha) || 1) / base;
  }
  const base = cultura.canteiro.comprimento * cultura.canteiro.largura;
  const actual =
    (parseFloat(params.comprimento_m) || cultura.canteiro.comprimento) *
    (parseFloat(params.largura_m) || cultura.canteiro.largura);
  return actual / base;
}

// ─── Calculadora core ────────────────────────────────────────────────────────

function CalculadoraCore({ cultura, loteId, initialParams }) {
  const isCampo = cultura.tipo === 'campo';
  const ins = cultura.insumos;
  const cor = cultura.cor;

  // Dimensões editáveis (pré-preenchidas se lote selecionado)
  const [params, setParams] = useState({
    area_ha: initialParams?.area_ha ?? '',
    total_plantas: initialParams?.total_plantas ?? '',
    comprimento_m: initialParams?.comprimento_m ?? (cultura.canteiro?.comprimento ?? ''),
    largura_m: initialParams?.largura_m ?? (cultura.canteiro?.largura ?? ''),
  });

  // Sync quando initialParams muda (novo lote selecionado)
  useEffect(() => {
    if (!initialParams) return;
    setParams({
      area_ha: initialParams.area_ha ?? '',
      total_plantas: initialParams.total_plantas ?? '',
      comprimento_m: initialParams.comprimento_m ?? (cultura.canteiro?.comprimento ?? ''),
      largura_m: initialParams.largura_m ?? (cultura.canteiro?.largura ?? ''),
    });
  }, [initialParams, cultura]);

  const PRECO_KEY = loteId
    ? `lote_precos_${loteId}`
    : `calc_precos_${cultura.id}`;

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

  // Reload precos quando cultura ou lote muda
  useEffect(() => {
    const saved = safeLS(PRECO_KEY, {});
    setPrecos({ ...defaultPrecos, ...saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PRECO_KEY]);

  const [maoObraReal, setMaoObraReal] = useState(0);
  const [savingMaoObra, setSavingMaoObra] = useState(false);
  const maoObraDebounceRef = useRef(null);

  const handleMaoObraChange = (value) => {
    const num = parseFloat(value) || 0;
    setMaoObraReal(num);

    if (!loteId) return; // sem lote, só local
    if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    maoObraDebounceRef.current = setTimeout(async () => {
      setSavingMaoObra(true);
      try {
        await updateLoteMaoObra(loteId, num);
      } catch {}
      finally { setSavingMaoObra(false); }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    };
  }, []);

  const updatePreco = useCallback((key, value) => {
    setPrecos(prev => {
      const next = { ...prev, [key]: parseFloat(value) || 0 };
      saveLS(PRECO_KEY, next);
      return next;
    });
  }, [PRECO_KEY]);

  const scale = calcScale(cultura, params);

  const insumoItems = [
    { key: 'calcareo',      label: 'Calcário',                   padrao: ins.calcareo?.padrao ?? 0,       unit: ins.calcareo?.unidade ?? 'kg',      toKg: 1 },
    { key: 'esterco',       label: 'Esterco bovino',              padrao: ins.esterco?.padrao ?? 0,        unit: ins.esterco?.unidade ?? 'kg',       toKg: 1 },
    { key: 'npk',           label: `NPK ${ins.npk?.formula ?? ''}`, padrao: ins.npk?.padrao ?? 0,         unit: ins.npk?.unidade ?? 'kg',           toKg: 1 },
    { key: 'ureia',         label: 'Ureia 46%',                   padrao: ins.ureia?.padrao ?? 0,          unit: ins.ureia?.unidade ?? 'g',          toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'nitratoCalcio', label: 'Nitrato de Cálcio',           padrao: ins.nitratoCalcio?.padrao ?? 0,  unit: ins.nitratoCalcio?.unidade ?? 'g',  toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'fte',           label: 'FTE BR-12',                   padrao: ins.fte?.padrao ?? 0,            unit: ins.fte?.unidade ?? 'g',            toKg: isCampo ? 1 : 1 / 1000 },
  ];

  const sementesQty   = (ins.sementes?.padrao ?? 0) * scale;
  const sementesCusto = sementesQty * (precos.sementes || ins.sementes?.precoUnitario || 0);

  let totalInsumos = maoObraReal + sementesCusto;
  insumoItems.forEach(item => {
    const qty = item.padrao * scale;
    totalInsumos += qty * item.toKg * (precos[item.key] ?? 0);
  });

  const scaleInfo = isCampo
    ? `${parseFloat(params.area_ha) || 0} ha · fator ${scale.toFixed(2)}× do padrão`
    : `${(
        (parseFloat(params.comprimento_m) || cultura.canteiro.comprimento) *
        (parseFloat(params.largura_m) || cultura.canteiro.largura)
      ).toFixed(1)} m² · fator ${scale.toFixed(2)}× do padrão`;

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">

      {/* Dimensões editáveis */}
      <div className="card p-4 mb-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Dimensões da área
        </p>
        {isCampo ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Área (ha)</label>
              <input
                type="number" min="0" step="0.01"
                value={params.area_ha}
                onChange={e => setParams(p => ({ ...p, area_ha: e.target.value }))}
                placeholder={`${cultura.area?.padrao ?? 1}`}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': cor }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Total de plantas</label>
              <input
                type="number" min="0"
                value={params.total_plantas}
                onChange={e => setParams(p => ({ ...p, total_plantas: e.target.value }))}
                placeholder="0"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Comprimento (m)</label>
              <input
                type="number" min="0" step="0.1"
                value={params.comprimento_m}
                onChange={e => setParams(p => ({ ...p, comprimento_m: e.target.value }))}
                placeholder={`${cultura.canteiro?.comprimento ?? 20}`}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': cor }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Largura (m)</label>
              <input
                type="number" min="0" step="0.1"
                value={params.largura_m}
                onChange={e => setParams(p => ({ ...p, largura_m: e.target.value }))}
                placeholder={`${cultura.canteiro?.largura ?? 1.6}`}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">{scaleInfo}</p>
      </div>

      {/* Tabela de insumos */}
      <p className="section-label mb-3">Insumos estimados</p>
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
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {scaledQty} {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">R$/kg</span>
                <input
                  type="number" min="0" step="0.01"
                  value={precos[item.key] ?? ''}
                  onChange={e => updatePreco(item.key, e.target.value)}
                  className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
                />
              </div>
              <div className="text-right flex-shrink-0 w-20">
                <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(custo)}</p>
              </div>
            </div>
          );
        })}

        {/* Sementes */}
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
              type="number" min="0" step="0.01"
              value={precos.sementes ?? ''}
              onChange={e => updatePreco('sementes', e.target.value)}
              className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
            />
          </div>
          <div className="text-right flex-shrink-0 w-20">
            <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(sementesCusto)}</p>
          </div>
        </div>

        {/* Mão de obra */}
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: 'hsl(210 16% 97%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[13px] font-semibold text-foreground">Mão de obra</p>
                {savingMaoObra && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {loteId ? 'Valor real para este ciclo' : 'Estimativa manual'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">R$</span>
              <input
                type="number" min="0" step="0.01"
                value={maoObraReal === 0 ? '' : maoObraReal}
                placeholder="0,00"
                onChange={e => handleMaoObraChange(e.target.value)}
                className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
              />
            </div>
            <div className="text-right flex-shrink-0 w-20">
              <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(maoObraReal)}</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `2px solid ${cor}30`, background: `${cor}08` }}
        >
          <p className="text-[13px] font-bold text-foreground">Total estimado</p>
          <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalInsumos)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── CalculadoraPage ─────────────────────────────────────────────────────────

export default function CalculadoraPage({ onBack }) {
  const culturasList = Object.values(CULTURAS);

  const [culturaId, setCulturaId] = useState('');
  const [propriedades, setPropriedades] = useState([]);
  const [propriedadeId, setPropriedadeId] = useState('');
  const [lotesDisponiveis, setLotesDisponiveis] = useState([]);
  const [loteId, setLoteId] = useState('');
  const [loteParams, setLoteParams] = useState(null);
  const [loadingProps, setLoadingProps] = useState(true);
  const [loadingLotes, setLoadingLotes] = useState(false);

  const cultura = culturaId ? CULTURAS[culturaId] : null;
  const cor = 'hsl(157 68% 26%)';

  // Carrega propriedades ao montar
  useEffect(() => {
    loadPropriedades()
      .then(setPropriedades)
      .catch(() => setPropriedades([]))
      .finally(() => setLoadingProps(false));
  }, []);

  // Ao selecionar propriedade: carrega lotes
  useEffect(() => {
    if (!propriedadeId) {
      setLotesDisponiveis([]);
      setLoteId('');
      setLoteParams(null);
      return;
    }
    setLoadingLotes(true);
    loadLotesByPropriedade(propriedadeId)
      .then(ls => {
        setLotesDisponiveis(ls);
        setLoteId('');
        setLoteParams(null);
      })
      .catch(() => setLotesDisponiveis([]))
      .finally(() => setLoadingLotes(false));
  }, [propriedadeId]);

  // Ao selecionar lote: preenche params e ajusta cultura
  useEffect(() => {
    if (!loteId) {
      setLoteParams(null);
      return;
    }
    const lote = lotesDisponiveis.find(l => l.id === loteId);
    if (!lote) return;
    // Preenche cultura com a do lote, se aplicável
    if (lote.cultura_id && CULTURAS[lote.cultura_id]) {
      setCulturaId(lote.cultura_id);
    }
    setLoteParams({
      area_ha:      lote.area_ha,
      total_plantas: lote.total_plantas,
      comprimento_m: lote.comprimento_m,
      largura_m:    lote.largura_m,
    });
  }, [loteId, lotesDisponiveis]);

  // Ao trocar cultura manualmente: limpa seleção de lote
  const handleCulturaChange = (id) => {
    setCulturaId(id);
    setLoteId('');
    setLoteParams(null);
  };

  // Filtra lotes da propriedade pela cultura selecionada (se cultura escolhida)
  const lotesParaExibir = culturaId
    ? lotesDisponiveis.filter(l => !l.cultura_id || l.cultura_id === culturaId)
    : lotesDisponiveis;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(160 84% 20%) 0%, hsl(160 84% 30%) 60%, hsl(152 60% 40%) 100%)',
        }}
      >
        {/* Blobs decorativos */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-30%', right: '-15%', width: '55%', height: '160%',
            background: `radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-30%', left: '-10%', width: '40%', height: '100%',
            background: `radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)`,
          }}
        />
        {/* Ícone watermark */}
        <div
          className="absolute right-4 bottom-0 pointer-events-none select-none opacity-[0.07]"
        >
          <Calculator size={110} color="white" />
        </div>

        <div className="relative z-10 px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top)' }}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-3"
          >
            <div
              className="h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              <Calculator size={20} color="white" />
            </div>
            <div>
              <p className="text-white/55 text-[11px] font-semibold leading-none mb-0.5">Ferramenta</p>
              <h1 className="font-display text-white font-extrabold leading-tight text-[22px]">
                Calculadora de Insumos
              </h1>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Seletores ── */}
      <div className="px-4 pt-5 pb-2 max-w-2xl mx-auto">

        {/* Cultura (obrigatório) */}
        <div className="card p-4 mb-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Cultura <span style={{ color: '#dc2626' }}>*</span>
          </p>
          <select
            value={culturaId}
            onChange={e => handleCulturaChange(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            <option value="">Selecione uma cultura…</option>
            {culturasList.map(c => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Pré-preencher com lote (opcional) */}
        <div className="card p-4 mb-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Pré-preencher com dados de um lote
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Opcional — preenche automaticamente a área e dimensões
          </p>

          {/* Propriedade */}
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Propriedade</label>
            {loadingProps ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={13} className="animate-spin text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">Carregando…</span>
              </div>
            ) : (
              <select
                value={propriedadeId}
                onChange={e => setPropriedadeId(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              >
                <option value="">Nenhuma</option>
                {propriedades.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Lote */}
          {propriedadeId && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Lote</label>
              {loadingLotes ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Loader2 size={13} className="animate-spin text-muted-foreground" />
                  <span className="text-[12px] text-muted-foreground">Carregando lotes…</span>
                </div>
              ) : lotesParaExibir.length === 0 ? (
                <p className="text-[12px] text-muted-foreground px-1 py-2">
                  {lotesDisponiveis.length === 0 ? 'Nenhum lote nesta propriedade' : 'Nenhum lote compatível com a cultura selecionada'}
                </p>
              ) : (
                <select
                  value={loteId}
                  onChange={e => setLoteId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                >
                  <option value="">Selecione um lote…</option>
                  {lotesParaExibir.map(l => {
                    const c = CULTURAS[l.cultura_id];
                    return (
                      <option key={l.id} value={l.id}>
                        {c ? `${c.emoji} ` : ''}{l.nome}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {loteParams && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'hsl(152 40% 94%)', border: '1px solid hsl(152 40% 82%)' }}
            >
              <span style={{ color: cor, fontSize: 14 }}>✓</span>
              <p className="text-[12px] font-semibold" style={{ color: cor }}>
                Dados do lote carregados
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Separador ── */}
      {cultura && (
        <div className="px-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'hsl(214 20% 88%)' }} />
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ background: `${cultura.cor}15`, color: cultura.cor }}
            >
              {cultura.emoji} {cultura.nome}
            </div>
            <div className="flex-1 h-px" style={{ background: 'hsl(214 20% 88%)' }} />
          </div>
        </div>
      )}

      {/* ── Calculadora ── */}
      {cultura ? (
        <motion.div
          key={culturaId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <CalculadoraCore
            cultura={cultura}
            loteId={loteId || null}
            initialParams={loteParams}
          />
        </motion.div>
      ) : (
        <div className="px-4 pb-16 max-w-2xl mx-auto">
          <div
            className="flex flex-col items-center gap-3 text-center py-16 rounded-2xl"
            style={{ background: 'hsl(210 16% 97%)', border: '1px dashed hsl(214 20% 85%)' }}
          >
            <Calculator size={36} className="opacity-20" style={{ color: cor }} />
            <p className="text-[14px] font-bold text-foreground">Selecione uma cultura</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[240px]">
              Escolha a cultura acima para ver os insumos estimados e calcular custos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
