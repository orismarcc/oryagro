import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import InsumoField from './InsumoField';
import ResultadoPanel from './ResultadoPanel';
import { useSimulador, calcularPlantas } from '../hooks/useSimulador';
import { useSimuladorSync, loadSimuladorConfig, registrarPlantio } from '../hooks/useSupabaseSync';
import { RotateCcw, Database, CheckCircle2 } from 'lucide-react';

const loadFromStorage = (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
};

export default function SimuladorFinanceiro({ cultura }) {
  const storageKey = `sim_${cultura.id}`;
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';

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
    };
  }, [cultura, isCampo, ins]);

  const [valores, setValores] = useState(() => loadFromStorage(storageKey, getDefaults()));
  const [plantioDialog, setPlantioDialog] = useState(false);
  const [plantioNome, setPlantioNome] = useState('');
  const [plantioData, setPlantioData] = useState(new Date().toISOString().split('T')[0]);
  const [plantioSaved, setPlantioSaved] = useState(null); // { id, nome }

  // Sync valores to Supabase (debounced)
  useSimuladorSync(cultura.id, valores);

  // Load from Supabase on first mount (prefer remote over localStorage)
  useEffect(() => {
    loadSimuladorConfig(cultura.id).then(remote => {
      if (remote && Object.keys(remote).length > 0) {
        setValores(remote);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultura.id]);

  // Track previous area to detect changes
  const prevAreaRef = useRef(null);

  // Auto-calculate insumos when area/dimensions change
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
  }, [
    isCampo ? valores.areaHa : valores.comprimento,
    isCampo ? valores.espacamentoLinhas : valores.largura,
  ]);

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

  const resetAll = () => {
    prevAreaRef.current = null;
    setValores(getDefaults());
  };

  const resultado = useSimulador(cultura, valores);
  const dim = calcularPlantas(cultura, valores);

  const currentArea = isCampo
    ? parseFloat(valores.areaHa) || cultura.area.padrao
    : (parseFloat(valores.comprimento) || cultura.canteiro.comprimento) * (parseFloat(valores.largura) || cultura.canteiro.largura);
  const baseArea = isCampo
    ? cultura.area.padrao
    : cultura.canteiro.comprimento * cultura.canteiro.largura;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-display font-semibold text-gray-900">Simulador Financeiro</h2>
          {isCampo && <p className="text-xs text-ambar-600 font-bold">Cálculo por hectare</p>}
          {plantioSaved && (
            <p className="text-xs text-verde-800 font-medium flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={12} /> Plantio "{plantioSaved.nome}" registrado
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setPlantioDialog(true)}>
            <Database size={13} />
            Registrar plantio
          </Button>
          <Button variant="amber" size="sm" onClick={resetAll}>
            <RotateCcw size={13} />
            Restaurar padrões
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
        <div>
          {/* DIMENSIONS */}
          <p className="text-[11px] font-bold text-verde-800 uppercase tracking-widest mb-3">
            {isCampo ? 'Área e Espaçamento' : 'Dimensões do Canteiro'}
          </p>

          <div className="flex flex-wrap gap-3 mb-2">
            {isCampo ? (
              <>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="areaHa">Área (ha)</Label>
                  <div className="relative w-32">
                    <Input id="areaHa" type="number" value={valores.areaHa ?? ''} onChange={handleNum('areaHa')} className="pr-8" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">ha</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="espL">Espaç. linhas</Label>
                  <div className="relative w-36">
                    <Input id="espL" type="number" value={valores.espacamentoLinhas ?? ''} onChange={handleNum('espacamentoLinhas')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="espP">Espaç. plantas</Label>
                  <div className="relative w-36">
                    <Input id="espP" type="number" value={valores.espacamentoPlantas ?? ''} onChange={handleNum('espacamentoPlantas')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="comp">Comprimento</Label>
                  <div className="relative w-32">
                    <Input id="comp" type="number" value={valores.comprimento ?? ''} onChange={handleNum('comprimento')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="larg">Largura</Label>
                  <div className="relative w-28">
                    <Input id="larg" type="number" value={valores.largura ?? ''} onChange={handleNum('largura')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="espL2">Espaç. linhas</Label>
                  <div className="relative w-32">
                    <Input id="espL2" type="number" value={valores.espacamentoLinhas ?? ''} onChange={handleNum('espacamentoLinhas')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="espP2">Espaç. plantas</Label>
                  <div className="relative w-32">
                    <Input id="espP2" type="number" value={valores.espacamentoPlantas ?? ''} onChange={handleNum('espacamentoPlantas')} className="pr-7" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live plant calc */}
          <div className="bg-verde-800 rounded-lg px-4 py-3 mb-5 text-sm border border-verde-700">
            {isCampo ? (
              <>
                <span className="text-verde-400 text-xs opacity-70">{(dim.areaHa || 0)} ha · {(parseFloat(valores.espacamentoLinhas) || cultura.espacamento.linhas).toFixed(2)} × {(parseFloat(valores.espacamentoPlantas) || cultura.espacamento.plantas).toFixed(2)} m</span>
                <div className="font-bold mt-0.5 text-white">
                  {(dim.plantasPorHa || 0).toLocaleString('pt-BR')} plantas/ha →{' '}
                  <span className="text-verde-400">{(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas no total</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-verde-400 text-xs opacity-70">{dim.comp || 0} × {dim.larg || 0} m = {(dim.area || 0).toFixed(1)} m² · espaçamento {(dim.spacingL || 0).toFixed(2)} × {(dim.spacingP || 0).toFixed(2)} m</span>
                <div className="font-bold mt-0.5 text-white">
                  {dim.linhas || 0} fileiras × {dim.porLinha || 0} plantas ={' '}
                  <span className="text-verde-400">{(dim.totalPlantas || 0).toLocaleString('pt-BR')} plantas/canteiro</span>
                </div>
              </>
            )}
          </div>

          {/* INSUMOS */}
          <p className="text-[11px] font-bold text-verde-800 uppercase tracking-widest mb-3">
            Insumos {isCampo ? '(por hectare — recalcula automaticamente com a área)' : '(recalcula automaticamente com as dimensões)'}
          </p>

          <InsumoField label={`Calcário (${ins.calcareo.unidade})`} campo="calcareo" culturaId={cultura.id}
            valor={valores.calcareo} valorPadrao={ins.calcareo.padrao} params={ins.calcareo}
            unidade={ins.calcareo.unidade} onChange={handleChange} />
          <InsumoField label={`Esterco bovino (${ins.esterco.unidade})`} campo="esterco" culturaId={cultura.id}
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

          <Separator className="my-4" />
          <p className="text-[11px] font-bold text-verde-800 uppercase tracking-widest mb-3">Venda e Mão de Obra</p>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label>Preço / {cultura.venda.unidade}</Label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                <Input type="number" value={valores.precoVenda ?? ''} onChange={handleNum('precoVenda')} className="pl-8" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Sobrevivência</Label>
              <div className="relative w-32">
                <Input type="number" value={valores.sobrevivencia ?? ''} onChange={handleNum('sobrevivencia')} className="pr-7" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Mão de obra{isCampo ? ' / ha' : ' / ciclo'}</Label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                <Input type="number" value={valores.modObra ?? ''} onChange={handleNum('modObra')} className="pl-8" />
              </div>
            </div>
          </div>
        </div>

        {/* RESULTADO PANEL */}
        <div className="md:sticky md:top-6 self-start">
          <ResultadoPanel resultado={resultado} cultura={cultura} />
        </div>
      </div>
      {/* REGISTRAR PLANTIO DIALOG */}
      <Dialog open={plantioDialog} onOpenChange={(o) => !o && setPlantioDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar plantio no banco</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 mb-3">
            Salva os parâmetros atuais como um plantio real no Supabase para acompanhamento histórico.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pNome">Nome / identificação</Label>
              <Input id="pNome" placeholder={`${cultura.nome} – Lote 1`}
                value={plantioNome} onChange={(e) => setPlantioNome(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pData">Data de plantio</Label>
              <Input id="pData" type="date" value={plantioData} onChange={(e) => setPlantioData(e.target.value)} />
            </div>
            <div className="bg-papel rounded border border-borda px-3 py-2 text-xs text-gray-600">
              <div className="font-semibold text-gray-800 mb-1">Resumo</div>
              {isCampo
                ? <><span>{dim.areaHa} ha · {dim.totalPlantas?.toLocaleString('pt-BR')} plantas</span></>
                : <><span>{dim.comp}×{dim.larg}m · {dim.totalPlantas} plantas</span></>
              }
              <div className="mt-1 text-verde-800 font-medium">
                Lucro estimado: {resultado.formatBRL(resultado.lucro)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlantioDialog(false)}>Cancelar</Button>
            <Button onClick={async () => {
              const dim2 = calcularPlantas(cultura, valores);
              const payload = {
                cultura_id: cultura.id,
                nome: plantioNome || `${cultura.nome} – ${plantioData}`,
                data_plantio: plantioData,
                comprimento_m: isCampo ? null : dim2.comp,
                largura_m: isCampo ? null : dim2.larg,
                area_ha: isCampo ? dim2.areaHa : parseFloat((dim2.area / 10000).toFixed(6)),
                espacamento_linhas: parseFloat(valores.espacamentoLinhas) || (isCampo ? cultura.espacamento.linhas : cultura.canteiro.espacamentoLinhas),
                espacamento_plantas: parseFloat(valores.espacamentoPlantas) || (isCampo ? cultura.espacamento.plantas : cultura.canteiro.espacamentoPlantas),
                total_plantas: dim2.totalPlantas,
              };
              const saved = await registrarPlantio(payload);
              if (saved) {
                setPlantioSaved({ id: saved.id, nome: saved.nome });
                setPlantioDialog(false);
              }
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
