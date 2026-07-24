import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import InsumoField from './InsumoField';
import ResultadoPanel from './ResultadoPanel';
import { useSimulador, calcularPlantas } from '../hooks/useSimulador';
import { useCurvasProducao } from '../hooks/useCurvasProducao';
import { useSimuladorSync, loadSimuladorConfig, registrarPlantio, preCarregarEtapasPadrao } from '../hooks/useSupabaseSync';
import { getPrecosPadrao, getOpCosts } from '../data/precos';
import { RotateCcw, Database, CheckCircle2, Pencil, Check, Package, Truck, Zap, ShieldCheck } from 'lucide-react';

const loadFromStorage = (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
};

function NumField({ label, field, valores, onChange, prefix, suffix, width = 'w-28' }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <div className={`relative ${width}`}>
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{prefix}</span>}
        <Input
          type="number"
          value={valores[field] ?? ''}
          onChange={e => { const raw = e.target.value; onChange(field, raw === '' ? '' : parseFloat(raw) || 0); }}
          className={prefix ? 'pl-8' : suffix ? 'pr-8' : ''}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

export default function SimuladorFinanceiro({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';
  const cor = cultura.cor;

  const getDefaults = useCallback(() => {
    const base = isCampo
      ? { areaHa: cultura.area.padrao, espacamentoLinhas: cultura.espacamento.linhas, espacamentoPlantas: cultura.espacamento.plantas }
      : { comprimento: cultura.canteiro.comprimento, largura: cultura.canteiro.largura, espacamentoLinhas: cultura.canteiro.espacamentoLinhas, espacamentoPlantas: cultura.canteiro.espacamentoPlantas };
    return {
      ...base,
      calcareo: ins.calcareo.padrao,
      esterco: ins.esterco.padrao,
      npk: ins.npk.padrao,
      ureia: ins.ureia.padrao,
      nitratoCalcio: ins.nitratoCalcio.padrao,
      modObra: ins.modObra.padrao,
      precoVenda: cultura.venda.precoUnitario,
      sobrevivencia: cultura.venda.sobrevivencia,
      // Layout em linhas (campo): nº de linhas pré-preenchido (talhão ~quadrado)
      ...(isCampo
        ? { numLinhas: Math.max(1, Math.round(Math.sqrt(cultura.area.padrao * 10000) / cultura.espacamento.linhas)) }
        : {}),
      // Espaldeira (maracujá, uva…): espaçamento entre estacas + valor unitário
      ...(cultura.espaldeira
        ? {
            espEstaca: cultura.espaldeira.espacamentoMourao || 5,
            valorEstaca: cultura.insumos.mouroes?.precoUnitario || 18,
          }
        : {}),
      // Preços dos insumos — médias MT 2024/2025
      ...getPrecosPadrao(isCampo),
      // Custos operacionais — por cultura, médias MT
      ...(() => { const op = getOpCosts(cultura.id, isCampo); return { custoEmbalagem: op.embalagem, custoTransporte: op.transporte, custoDefensivos: op.defensivos, custoEnergia: op.energia }; })(),
    };
  }, [cultura, isCampo, ins]);

  const [valores, setValores] = useState(() => loadFromStorage(storageKey, getDefaults()));
  const [metaLucro, setMetaLucro] = useState('');
  const [editInsumos, setEditInsumos] = useState(false);
  const [editPrecos, setEditPrecos] = useState(false);
  const [plantioDialog, setPlantioDialog] = useState(false);
  const [plantioNome, setPlantioNome] = useState('');
  const [plantioData, setPlantioData] = useState(new Date().toISOString().split('T')[0]);
  const [plantioSaved, setPlantioSaved] = useState(null);

  useSimuladorSync(cultura.id, valores);
  // Aquece o cache de curvas de produção (inclui as CALIBRADAS pelo usuário),
  // para que a projeção multi-ano use a curva real e não só o padrão do sistema.
  useCurvasProducao();

  useEffect(() => {
    loadSimuladorConfig(cultura.id).then(remote => {
      if (remote && Object.keys(remote).length > 0) setValores(prev => ({ ...getDefaults(), ...remote }));
    });
  }, [cultura.id]);

  const prevAreaRef = useRef(null);

  // Auto-scale insumos when area changes
  useEffect(() => {
    let currentArea;
    if (isCampo) {
      currentArea = parseFloat(valores.areaHa) || cultura.area.padrao;
    } else {
      const comp = parseFloat(valores.comprimento) || cultura.canteiro.comprimento;
      const larg = parseFloat(valores.largura) || cultura.canteiro.largura;
      currentArea = comp * larg;
    }
    if (prevAreaRef.current !== null && prevAreaRef.current !== currentArea) {
      const baseArea = isCampo ? cultura.area.padrao : (cultura.canteiro.comprimento * cultura.canteiro.largura);
      const fator = currentArea / baseArea;
      setValores(v => ({
        ...v,
        calcareo:      parseFloat((ins.calcareo.padrao  * fator).toFixed(3)),
        esterco:       parseFloat((ins.esterco.padrao   * fator).toFixed(1)),
        npk:           parseFloat((ins.npk.padrao       * fator).toFixed(3)),
        ureia:         parseFloat((ins.ureia.padrao     * fator).toFixed(isCampo ? 1 : 0)),
        nitratoCalcio: parseFloat((ins.nitratoCalcio.padrao * fator).toFixed(isCampo ? 1 : 0)),
      }));
    }
    prevAreaRef.current = currentArea;
  }, [isCampo ? valores.areaHa : valores.comprimento, isCampo ? valores.espacamentoLinhas : valores.largura]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(valores)); }, [storageKey, valores]);

  // Called by NumField: onChange(campo, parsedValue)
  const handleChange = useCallback((campo, val) => setValores(v => ({ ...v, [campo]: val })), []);
  // Called by raw <Input> elements: onChange={handleNum('campo')}
  const handleNum = (campo) => (e) => {
    const raw = e.target.value;
    setValores(prev => ({ ...prev, [campo]: raw === '' ? '' : parseFloat(raw) || 0 }));
  };
  const resetAll = () => { prevAreaRef.current = null; setValores(getDefaults()); setEditInsumos(false); setEditPrecos(false); };

  // Compute scale factor for alert params
  const baseArea = isCampo
    ? (cultura.area?.padrao || 1)
    : (cultura.canteiro.comprimento * cultura.canteiro.largura);
  const currentArea = isCampo
    ? (parseFloat(valores.areaHa) || cultura.area?.padrao || 1)
    : (parseFloat(valores.comprimento) || cultura.canteiro.comprimento) * (parseFloat(valores.largura) || cultura.canteiro.largura);
  const fator = currentArea / baseArea;

  const scaledParams = (params) => ({
    ...params,
    min: (params.min || 0) * fator,
    max: (params.max || Infinity) * fator,
  });

  const resultado = useSimulador(cultura, valores);
  const dim = calcularPlantas(cultura, valores);
  const fmtNum = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('pt-BR'));

  // As quantidades de insumo já são o TOTAL para a área digitada (auto-escaladas
  // acima), então a unidade não deve dizer "/ha" — isso confundia. Ex.: com 2 ha,
  // 3000 kg é o total, não "3000 kg/ha". Removemos o "/ha" do rótulo (a área
  // aparece no cabeçalho da seção). As doses do cronograma continuam por-ha.
  const unidadeArea = (u) => (isCampo ? (u || '').replace(/\s*\/\s*ha/gi, '').trim() || u : u);
  const areaLabel = isCampo
    ? `${(parseFloat(valores.areaHa) || cultura.area?.padrao || 1).toLocaleString('pt-BR')} ha`
    : `${(dim.area || 0).toFixed(1)} m²`;

  // ── Meta de lucro (goal-seek) ──
  // Dado um lucro-alvo por período, estima quantas plantas/área seriam necessárias
  // mantendo o mesmo espaçamento, preços e manejo (escala proporcional ao lucro).
  const meta = parseFloat(metaLucro) || 0;
  const metaViavel = meta > 0 && resultado.lucro > 0;
  const fatorMeta = metaViavel ? meta / resultado.lucro : 0;
  const metaPlantas = metaViavel ? Math.round((dim.totalPlantas || 0) * fatorMeta) : 0;
  const metaArea = metaViavel ? (isCampo ? (dim.areaHa || 0) * fatorMeta : ((dim.area || 0) / 10000) * fatorMeta) : 0;

  const insumoRows = [
    { label: 'Calcário',         value: valores.calcareo,      unit: unidadeArea(ins.calcareo.unidade) },
    { label: 'Esterco bovino',    value: valores.esterco,       unit: unidadeArea(ins.esterco.unidade) },
    { label: `NPK ${ins.npk.formula}`, value: valores.npk,     unit: unidadeArea(ins.npk.unidade) },
    { label: 'Ureia 46%',         value: valores.ureia,         unit: unidadeArea(ins.ureia.unidade) },
    { label: 'Nitrato de Cálcio', value: valores.nitratoCalcio, unit: unidadeArea(ins.nitratoCalcio.unidade) },
  ];

  return (
    <div className="px-4 pt-5 pb-4 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Simulador Financeiro</h2>
          {isCampo && <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: cor }}>Quantidades para {areaLabel}</p>}
          {plantioSaved && (
            <p className="text-[12px] font-medium flex items-center gap-1 mt-0.5" style={{ color: 'hsl(142 72% 30%)' }}>
              <CheckCircle2 size={12} /> Plantio "{plantioSaved.nome}" registrado
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setPlantioDialog(true)}>
            <Database size={13} /> Registrar
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw size={13} /> Padrões
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">

          {/* ── Dimensions ── */}
          <div className="card-elevated p-4">
            <p className="section-label mb-3" style={{ color: cor }}>
              {isCampo ? 'Área e Espaçamento' : 'Dimensões do Canteiro'}
            </p>
            <div className="flex flex-wrap gap-3">
              {isCampo ? (
                <>
                  <NumField label="Área (ha)"       field="areaHa"            valores={valores} onChange={handleChange} suffix="ha" />
                  <NumField label="Espaç. linhas"   field="espacamentoLinhas" valores={valores} onChange={handleChange} suffix="m"  />
                  <NumField label="Espaç. plantas"  field="espacamentoPlantas"valores={valores} onChange={handleChange} suffix="m"  />
                  <NumField label="Nº de linhas"    field="numLinhas"         valores={valores} onChange={handleChange} suffix="un" />
                </>
              ) : (
                <>
                  <NumField label="Comprimento"     field="comprimento"       valores={valores} onChange={handleChange} suffix="m" width="w-28" />
                  <NumField label="Largura"         field="largura"           valores={valores} onChange={handleChange} suffix="m" width="w-24" />
                  <NumField label="Espaç. linhas"   field="espacamentoLinhas" valores={valores} onChange={handleChange} suffix="m" width="w-28" />
                  <NumField label="Espaç. plantas"  field="espacamentoPlantas"valores={valores} onChange={handleChange} suffix="m" width="w-28" />
                </>
              )}
            </div>
            <div className="mt-3 rounded-xl px-4 py-3" style={{ background: `${cor}10`, border: `1px solid ${cor}22` }}>
              {isCampo ? (
                <>
                  <p className="text-[11px] mb-0.5" style={{ color: `${cor}80` }}>
                    {dim.areaHa || 0} ha · {(parseFloat(valores.espacamentoLinhas) || cultura.espacamento.linhas).toFixed(2)} × {(parseFloat(valores.espacamentoPlantas) || cultura.espacamento.plantas).toFixed(2)} m
                  </p>
                  <p className="text-[13px] font-semibold" style={{ color: cor }}>
                    {fmtNum(dim.numLinhas)} linhas × ~{fmtNum(dim.comprimentoLinha)} m · {fmtNum(dim.plantasPorLinha)} pl/linha
                  </p>
                  <p className="text-[12px] font-semibold mt-0.5" style={{ color: `${cor}b0` }}>
                    {(dim.plantasPorHa || 0).toLocaleString('pt-BR')} pl/ha → {(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] mb-0.5" style={{ color: `${cor}80` }}>
                    {dim.comp || 0} × {dim.larg || 0} m = {(dim.area || 0).toFixed(1)} m²
                  </p>
                  <p className="text-[13px] font-semibold" style={{ color: cor }}>
                    {dim.linhas || 0} fileiras × {dim.porLinha || 0} = {(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas
                  </p>
                </>
              )}
            </div>

            {/* ── Espaldeira: estacas/mourões (maracujá, uva…) ── */}
            {cultura.espaldeira && (
              <div className="mt-3 rounded-xl px-4 py-3" style={{ background: `${cor}08`, border: `1px solid ${cor}22` }}>
                <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5" style={{ color: cor }}>
                  🪵 Espaldeira — estacas/mourões
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <NumField label="Espaç. estacas" field="espEstaca"   valores={valores} onChange={handleChange} suffix="m"  width="w-28" />
                  <NumField label="Valor unitário" field="valorEstaca" valores={valores} onChange={handleChange} suffix="R$" width="w-28" />
                </div>
                <p className="text-[13px] font-semibold mt-2" style={{ color: cor }}>
                  {fmtNum(dim.estacas)} estacas
                  <span className="font-normal" style={{ color: `${cor}90` }}> ({fmtNum(dim.numLinhas)} linhas × 1 a cada {(parseFloat(valores.espEstaca) || cultura.espaldeira.espacamentoMourao || 5)} m)</span>
                  {' '}· custo ≈ {resultado.formatBRL((dim.estacas || 0) * (parseFloat(valores.valorEstaca) || cultura.insumos.mouroes?.precoUnitario || 18))}
                </p>
              </div>
            )}
          </div>

          {/* ── Meta de lucro (goal-seek) ── */}
          <div className="card-elevated p-4">
            <p className="section-label mb-3" style={{ color: cor }}>🎯 Meta de lucro (por {resultado.periodo})</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quero lucrar (R$/{resultado.periodo})
                </label>
                <input
                  type="number" inputMode="numeric" min="0" value={metaLucro}
                  onChange={e => setMetaLucro(e.target.value)}
                  placeholder="ex.: 30000"
                  className="w-40 px-3 py-2 rounded-xl text-[13px] font-semibold text-foreground outline-none"
                  style={{ background: 'hsl(140 14% 96%)', border: '1px solid hsl(140 13% 88%)' }}
                />
              </div>
            </div>
            {metaViavel ? (
              <p className="text-[12px] leading-snug mt-2" style={{ color: cor }}>
                Para lucrar <b>{resultado.formatBRL(meta)}/{resultado.periodo}</b> — mantendo este espaçamento, preços e manejo —
                você precisaria de aproximadamente <b>{fmtNum(metaPlantas)} plantas</b>
                {isCampo ? <> (~<b>{metaArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha</b>)</> : null}.
                {fatorMeta < 1 && <span className="text-muted-foreground"> Menos do que você tem agora — já supera a meta.</span>}
              </p>
            ) : meta > 0 ? (
              <p className="text-[12px] mt-2 text-muted-foreground">
                Ajuste os inputs para ter <b>lucro positivo</b> primeiro — aí calculo a área/plantas para a sua meta.
              </p>
            ) : (
              <p className="text-[11px] mt-2 text-muted-foreground">
                Informe um lucro-alvo e eu estimo quantas plantas/área você precisaria com os parâmetros atuais.
              </p>
            )}
          </div>

          {/* ── Fluxo de caixa multi-ano (perenes) ── */}
          {resultado.projecaoMultiAno && resultado.projecaoMultiAno.length > 0 && (
            <div className="card-elevated p-4">
              <p className="section-label mb-1" style={{ color: cor }}>📈 Fluxo de caixa — {resultado.projecaoMultiAno.length} anos</p>
              <p className="text-[10.5px] text-muted-foreground mb-3 leading-snug">
                Ano 1 = implantação (custo cheio, produção parcial); anos seguintes = manutenção, com a produção subindo pela curva da cultura.
              </p>

              {/* Payback */}
              <div className="rounded-xl px-3.5 py-3 mb-3 flex items-center justify-between"
                style={{ background: resultado.paybackAno ? `${cor}0f` : 'hsl(4 80% 96%)', border: `1px solid ${resultado.paybackAno ? `${cor}30` : '#fca5a5'}` }}>
                <span className="text-[11px] font-semibold" style={{ color: resultado.paybackAno ? cor : '#dc2626' }}>
                  {resultado.paybackAno ? 'Retorno do investimento (payback)' : 'Não se paga no horizonte'}
                </span>
                <span className="text-[15px] font-black" style={{ color: resultado.paybackAno ? cor : '#dc2626' }}>
                  {resultado.paybackAno ? `Ano ${resultado.paybackAno}` : '—'}
                </span>
              </div>

              {/* Tabela ano a ano */}
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Ano</th>
                      <th className="text-right font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Prod.</th>
                      <th className="text-right font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Receita</th>
                      <th className="text-right font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Custo</th>
                      <th className="text-right font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Lucro</th>
                      <th className="text-right font-bold uppercase tracking-wider text-[9px] py-1.5 px-1">Acum.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.projecaoMultiAno.map((r) => {
                      const pay = resultado.paybackAno === r.ano;
                      return (
                        <tr key={r.ano} style={{ borderTop: '1px solid hsl(150 14% 90%)', background: pay ? `${cor}0c` : 'transparent' }}>
                          <td className="py-1.5 px-1 font-bold text-foreground">{r.ano}{pay && ' 🏁'}</td>
                          <td className="py-1.5 px-1 text-right tabular-nums text-muted-foreground">{Math.round(r.fator * 100)}%</td>
                          <td className="py-1.5 px-1 text-right tabular-nums text-foreground">{resultado.formatBRL(r.receita)}</td>
                          <td className="py-1.5 px-1 text-right tabular-nums" style={{ color: '#b5451b' }}>{resultado.formatBRL(r.custo)}</td>
                          <td className="py-1.5 px-1 text-right tabular-nums font-semibold" style={{ color: r.lucro >= 0 ? 'hsl(142 72% 30%)' : '#dc2626' }}>{resultado.formatBRL(r.lucro)}</td>
                          <td className="py-1.5 px-1 text-right tabular-nums font-bold" style={{ color: r.acumulado >= 0 ? 'hsl(142 72% 30%)' : '#dc2626' }}>{resultado.formatBRL(r.acumulado)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Insumos ── */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="section-label" style={{ color: cor }}>Insumos</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {editInsumos ? 'Ajuste manual ativo' : 'Auto-calculado pelas dimensões'}
                </p>
              </div>
              <button
                onClick={() => setEditInsumos(e => !e)}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors"
                style={editInsumos
                  ? { background: cor, color: '#fff', borderColor: cor }
                  : { background: 'transparent', color: cor, borderColor: `${cor}40` }}
              >
                {editInsumos ? <><Check size={11} /> Concluir</> : <><Pencil size={11} /> Editar</>}
              </button>
            </div>

            {editInsumos ? (
              <div className="space-y-0">
                <InsumoField label={`Calcário (${unidadeArea(ins.calcareo.unidade)})`} campo="calcareo" culturaId={cultura.id}
                  valor={valores.calcareo} valorPadrao={ins.calcareo.padrao} params={scaledParams(ins.calcareo)} unidade={unidadeArea(ins.calcareo.unidade)} onChange={handleChange} />
                <InsumoField label={`Esterco bovino (${unidadeArea(ins.esterco.unidade)})`} campo="esterco" culturaId={cultura.id}
                  valor={valores.esterco} valorPadrao={ins.esterco.padrao} params={scaledParams(ins.esterco)} unidade={unidadeArea(ins.esterco.unidade)} onChange={handleChange} />
                <InsumoField label={`NPK ${ins.npk.formula} (${unidadeArea(ins.npk.unidade)})`} campo="npk" culturaId={cultura.id}
                  valor={valores.npk} valorPadrao={ins.npk.padrao} params={scaledParams(ins.npk)} unidade={unidadeArea(ins.npk.unidade)} onChange={handleChange} />
                <InsumoField label={`Ureia 46% (${unidadeArea(ins.ureia.unidade)})`} campo="ureia" culturaId={cultura.id}
                  valor={valores.ureia} valorPadrao={ins.ureia.padrao} params={scaledParams(ins.ureia)} unidade={unidadeArea(ins.ureia.unidade)} onChange={handleChange} />
                <InsumoField label={`Nitrato de Cálcio (${unidadeArea(ins.nitratoCalcio.unidade)})`} campo="nitratoCalcio" culturaId={cultura.id}
                  valor={valores.nitratoCalcio} valorPadrao={ins.nitratoCalcio.padrao} params={scaledParams(ins.nitratoCalcio)} unidade={unidadeArea(ins.nitratoCalcio.unidade)} onChange={handleChange} />

                {/* Editable prices */}
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid hsl(140 13% 90%)' }}>
                  <p className="section-label mb-3" style={{ color: cor }}>Preço por unidade (R$)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Calcário / kg"        field="precoCalcareo"  valores={valores} onChange={handleChange} prefix="R$" width="w-full" />
                    <NumField label="Esterco / kg"         field="precoEsterco"   valores={valores} onChange={handleChange} prefix="R$" width="w-full" />
                    <NumField label="NPK / kg"             field="precoNPK"       valores={valores} onChange={handleChange} prefix="R$" width="w-full" />
                    <NumField label="Ureia / kg"           field="precoUreia"     valores={valores} onChange={handleChange} prefix="R$" width="w-full" />
                    <NumField label="Nitrato de Cálcio/kg" field="precoNitratoCa" valores={valores} onChange={handleChange} prefix="R$" width="w-full" />
                    {!isCampo && <NumField label="Mulching / m²"   field="precoMulching"  valores={valores} onChange={handleChange} prefix="R$" width="w-full" />}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {insumoRows.map((row, i, arr) => (
                  <div key={row.label} className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid hsl(140 13% 92%)' : 'none' }}>
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="font-display text-[15px] font-bold" style={{ color: cor }}>
                      {typeof row.value === 'number'
                        ? row.value % 1 === 0
                          ? row.value.toLocaleString('pt-BR')
                          : row.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                        : row.value ?? ins[Object.keys(ins).find(k => ins[k]?.padrao)]?.padrao}
                      <span className="text-[11px] font-normal text-muted-foreground ml-1">{row.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Custos de Produção ── */}
          <div className="card-elevated p-4">
            <p className="section-label mb-3" style={{ color: cor }}>Custos de Produção</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Package size={11} style={{ color: cor }} /> Embalagem / ciclo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                  <Input type="number" value={valores.custoEmbalagem ?? ''} onChange={handleNum('custoEmbalagem')} className="pl-8" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Truck size={11} style={{ color: cor }} /> Transporte / ciclo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                  <Input type="number" value={valores.custoTransporte ?? ''} onChange={handleNum('custoTransporte')} className="pl-8" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck size={11} style={{ color: cor }} /> Defensivos / ciclo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                  <Input type="number" value={valores.custoDefensivos ?? ''} onChange={handleNum('custoDefensivos')} className="pl-8" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Zap size={11} style={{ color: cor }} /> Energia/Irrigação
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                  <Input type="number" value={valores.custoEnergia ?? ''} onChange={handleNum('custoEnergia')} className="pl-8" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Venda e Mão de Obra ── */}
          <div className="card-elevated p-4">
            <p className="section-label mb-3" style={{ color: cor }}>Venda e Mão de Obra</p>
            <div className="flex flex-wrap gap-3">
              <NumField label={`Preço / ${cultura.venda.unidade}`} field="precoVenda"   valores={valores} onChange={handleChange} prefix="R$" width="w-32" />
              <NumField label="Sobrevivência"                       field="sobrevivencia"valores={valores} onChange={handleChange} suffix="%"   width="w-28" />
              <NumField label={`Mão de obra${isCampo ? ' / ha' : ' / ciclo'}`} field="modObra" valores={valores} onChange={handleChange} prefix="R$" width="w-32" />
            </div>
          </div>
        </div>

        {/* ── ResultadoPanel ── */}
        <div className="md:sticky md:top-4 self-start">
          <ResultadoPanel resultado={resultado} cultura={cultura} />
        </div>
      </div>

      {/* ── Plantio dialog ── */}
      <Dialog open={plantioDialog} onOpenChange={(o) => !o && setPlantioDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar plantio</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">Salva os parâmetros no Supabase para histórico.</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>Nome / identificação</Label>
              <Input placeholder={`${cultura.nome} – Lote 1`} value={plantioNome} onChange={e => setPlantioNome(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Data de plantio</Label>
              <Input type="date" value={plantioData} onChange={e => setPlantioData(e.target.value)} />
            </div>
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: `${cor}0d`, border: `1px solid ${cor}20` }}>
              <div className="font-semibold text-foreground mb-1">Resumo</div>
              {isCampo ? <span>{dim.areaHa} ha · {dim.totalPlantas?.toLocaleString('pt-BR')} plantas</span>
                       : <span>{dim.comp}×{dim.larg}m · {dim.totalPlantas} plantas</span>}
              <div className="mt-1 font-semibold" style={{ color: cor }}>Lucro est.: {resultado.formatBRL(resultado.lucro)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlantioDialog(false)}>Cancelar</Button>
            <Button onClick={async () => {
              const dim2 = calcularPlantas(cultura, valores);
              const saved = await registrarPlantio({
                cultura_id: cultura.id,
                nome: plantioNome || `${cultura.nome} – ${plantioData}`,
                data_plantio: plantioData,
                comprimento_m: isCampo ? null : dim2.comp,
                largura_m: isCampo ? null : dim2.larg,
                area_ha: isCampo ? dim2.areaHa : parseFloat((dim2.area / 10000).toFixed(6)),
                espacamento_linhas: parseFloat(valores.espacamentoLinhas) || (isCampo ? cultura.espacamento.linhas : cultura.canteiro.espacamentoLinhas),
                espacamento_plantas: parseFloat(valores.espacamentoPlantas) || (isCampo ? cultura.espacamento.plantas : cultura.canteiro.espacamentoPlantas),
                total_plantas: dim2.totalPlantas,
              });
              if (saved) {
                preCarregarEtapasPadrao(saved, cultura, 0).catch(() => {});
                setPlantioSaved({ id: saved.id, nome: saved.nome });
                setPlantioDialog(false);
              }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
