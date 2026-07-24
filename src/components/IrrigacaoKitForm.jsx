/**
 * IrrigacaoKitForm.jsx — configura o sistema de irrigação instalado no talhão.
 *
 * O dado essencial é a TAXA DE APLICAÇÃO (mm/h): quanto de lâmina o sistema
 * entrega por hora. O produtor pode informá-la direto (se souber) ou deixar o
 * app derivar da vazão do emissor ÷ área que ele atende (1 L/m² = 1 mm).
 * Essa taxa é o que permite converter "precisa de 5 mm" em "ligar por 40 min".
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Droplets, Check, Loader2, Calculator } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  SISTEMAS_IRRIGACAO, eficienciaPadrao, taxaAplicacaoMmH, tempoIrrigacao,
} from '../lib/clima';
import { updateTalhaoIrrigacao, updatePlantioIrrigacao } from '../hooks/useSupabaseSync';

/**
 * @param {'talhao'|'lote'} entidade — define em qual tabela o kit é salvo.
 *   'talhao' → talhoes (perenes) · 'lote' → plantios (safras e culturas anuais)
 */
export default function IrrigacaoKitForm({ talhao, onClose, onSaved, entidade = 'talhao' }) {
  const persistir = entidade === 'lote' ? updatePlantioIrrigacao : updateTalhaoIrrigacao;
  const toast = useToast();
  const [tipo, setTipo] = useState(talhao?.irrigacao_tipo || '');
  // modo de definição da taxa: 'direta' (mm/h) ou 'emissor' (vazão ÷ área)
  const [modo, setModo] = useState(talhao?.irrigacao_taxa_mm_h ? 'direta' : 'emissor');
  const [taxaDireta, setTaxaDireta] = useState(talhao?.irrigacao_taxa_mm_h != null ? String(talhao.irrigacao_taxa_mm_h) : '');
  const [vazao, setVazao] = useState(talhao?.irrigacao_vazao_emissor_lh != null ? String(talhao.irrigacao_vazao_emissor_lh) : '');
  const [espEmissor, setEspEmissor] = useState('');   // m entre emissores na linha
  const [espLinha, setEspLinha] = useState('');       // m entre linhas
  const [areaEmissor, setAreaEmissor] = useState(talhao?.irrigacao_area_emissor_m2 != null ? String(talhao.irrigacao_area_emissor_m2) : '');
  const [efic, setEfic] = useState(talhao?.irrigacao_eficiencia != null ? String(talhao.irrigacao_eficiencia * 100) : '');
  const [salvando, setSalvando] = useState(false);

  // Se o produtor informar os espaçamentos, a área do emissor sai deles
  const areaCalc = useMemo(() => {
    const a = parseFloat(espEmissor), b = parseFloat(espLinha);
    if (a > 0 && b > 0) return Math.round(a * b * 1000) / 1000;
    return null;
  }, [espEmissor, espLinha]);

  const areaFinal = areaCalc ?? parseFloat(areaEmissor);
  const eficFinal = (parseFloat(efic) / 100) || eficienciaPadrao(tipo);

  const taxa = useMemo(() => {
    if (modo === 'direta') {
      const t = parseFloat(taxaDireta);
      return t > 0 ? t : null;
    }
    return taxaAplicacaoMmH({ vazaoLh: parseFloat(vazao), areaEmissorM2: areaFinal });
  }, [modo, taxaDireta, vazao, areaFinal]);

  // Prévia: quanto tempo para aplicar 5 mm
  const previa = taxa ? tempoIrrigacao({ laminaMm: 5, taxaMmH: taxa, eficiencia: eficFinal }) : null;

  const escolherTipo = (id) => {
    setTipo(id);
    if (!efic) setEfic(String(Math.round(eficienciaPadrao(id) * 100)));
  };

  const salvar = async () => {
    if (!tipo) { toast.error('Escolha o tipo de sistema.'); return; }
    if (!taxa) { toast.error('Informe a taxa de aplicação ou a vazão e o espaçamento dos emissores.'); return; }
    setSalvando(true);
    try {
      const kit = {
        irrigacao_tipo: tipo,
        irrigacao_taxa_mm_h: modo === 'direta' ? taxa : null,
        irrigacao_vazao_emissor_lh: modo === 'emissor' ? (parseFloat(vazao) || null) : null,
        irrigacao_area_emissor_m2: modo === 'emissor' ? (areaFinal || null) : null,
        irrigacao_eficiencia: Math.round(eficFinal * 100) / 100,
      };
      const updated = await persistir(talhao.id, kit);
      toast.success('Sistema de irrigação salvo!');
      onSaved?.(updated ?? kit);
      onClose?.();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!window.confirm('Remover o sistema de irrigação deste talhão?')) return;
    setSalvando(true);
    try {
      const kit = {
        irrigacao_tipo: null, irrigacao_taxa_mm_h: null, irrigacao_vazao_emissor_lh: null,
        irrigacao_area_emissor_m2: null, irrigacao_eficiencia: null,
      };
      const updated = await persistir(talhao.id, kit);
      toast.success('Sistema removido.');
      onSaved?.(updated ?? kit);
      onClose?.();
    } catch {
      toast.error('Erro ao remover.');
    } finally {
      setSalvando(false);
    }
  };

  const inputCls = 'w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none bg-background';
  const labelCls = 'text-[10px] font-bold uppercase tracking-wide text-muted-foreground';
  const bd = { borderColor: 'hsl(205 40% 78%)' };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center gap-2 text-white" style={{ background: '#0369a1' }}>
          <Droplets size={17} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight">Sistema de irrigação</p>
            <p className="text-[10.5px] text-white/70 truncate">{talhao?.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo de sistema</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {SISTEMAS_IRRIGACAO.map(s => (
                <button key={s.id} type="button" onClick={() => escolherTipo(s.id)}
                  className="rounded-xl px-2 py-2.5 text-[11px] font-bold transition-all"
                  style={tipo === s.id
                    ? { background: '#0369a1', color: 'white' }
                    : { background: 'hsl(205 40% 94%)', color: '#0369a1' }}>
                  {s.label}
                </button>
              ))}
            </div>
            {tipo && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {SISTEMAS_IRRIGACAO.find(s => s.id === tipo)?.dica} Eficiência típica: {Math.round(eficienciaPadrao(tipo) * 100)}%.
              </p>
            )}
          </div>

          {/* Modo de definir a taxa */}
          <div>
            <label className={labelCls}>Como definir a vazão do sistema</label>
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={() => setModo('emissor')}
                className="flex-1 rounded-xl px-2 py-2 text-[11px] font-bold"
                style={modo === 'emissor' ? { background: '#0369a1', color: 'white' } : { background: 'hsl(205 40% 94%)', color: '#0369a1' }}>
                Pelo emissor
              </button>
              <button type="button" onClick={() => setModo('direta')}
                className="flex-1 rounded-xl px-2 py-2 text-[11px] font-bold"
                style={modo === 'direta' ? { background: '#0369a1', color: 'white' } : { background: 'hsl(205 40% 94%)', color: '#0369a1' }}>
                Sei o mm/h
              </button>
            </div>
          </div>

          {modo === 'direta' ? (
            <div>
              <label className={labelCls}>Taxa de aplicação (mm/h)</label>
              <input type="number" step="0.1" min="0" value={taxaDireta} onChange={e => setTaxaDireta(e.target.value)}
                placeholder="Ex.: 8" className={inputCls} style={bd} />
              <p className="text-[10px] text-muted-foreground mt-1">Quantos milímetros de lâmina o sistema aplica em 1 hora.</p>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Vazão de cada emissor (L/h)</label>
                <input type="number" step="0.1" min="0" value={vazao} onChange={e => setVazao(e.target.value)}
                  placeholder="Ex.: 2 (gotejador) · 50 (microaspersor)" className={inputCls} style={bd} />
              </div>
              <div>
                <label className={labelCls}>Espaçamento dos emissores</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input type="number" step="0.01" min="0" value={espEmissor} onChange={e => setEspEmissor(e.target.value)}
                    placeholder="entre emissores (m)" className="w-full rounded-xl border px-3 py-2 text-sm bg-background" style={bd} />
                  <input type="number" step="0.01" min="0" value={espLinha} onChange={e => setEspLinha(e.target.value)}
                    placeholder="entre linhas (m)" className="w-full rounded-xl border px-3 py-2 text-sm bg-background" style={bd} />
                </div>
                {areaCalc != null ? (
                  <p className="text-[10px] mt-1" style={{ color: '#0369a1' }}>
                    Cada emissor atende {areaCalc} m².
                  </p>
                ) : (
                  <div className="mt-2">
                    <label className={labelCls}>ou área por emissor (m²)</label>
                    <input type="number" step="0.01" min="0" value={areaEmissor} onChange={e => setAreaEmissor(e.target.value)}
                      placeholder="Ex.: 0.15" className={inputCls} style={bd} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Eficiência */}
          <div>
            <label className={labelCls}>Eficiência de aplicação (%)</label>
            <input type="number" min="1" max="100" value={efic} onChange={e => setEfic(e.target.value)}
              placeholder={String(Math.round(eficienciaPadrao(tipo) * 100))} className={inputCls} style={bd} />
            <p className="text-[10px] text-muted-foreground mt-1">Parte da água que efetivamente chega à planta. O tempo é ajustado para compensar as perdas.</p>
          </div>

          {/* Prévia */}
          {taxa && (
            <div className="rounded-xl p-3" style={{ background: 'hsl(205 70% 95%)', border: '1px solid hsl(205 60% 84%)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Calculator size={13} style={{ color: '#0369a1' }} />
                <span className="text-[11px] font-bold" style={{ color: '#0369a1' }}>Conferência</span>
              </div>
              <p className="text-[11.5px] text-foreground">
                Taxa: <strong>{taxa} mm/h</strong>
                {previa && <> · para aplicar <strong>5 mm</strong> ligar por <strong>{previa.h > 0 ? `${previa.h}h ` : ''}{previa.min}min</strong></>}
              </p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex gap-2">
          {talhao?.irrigacao_tipo && (
            <button onClick={remover} disabled={salvando}
              className="px-3 py-3 rounded-xl font-bold text-[12px] text-red-600" style={{ background: 'hsl(4 60% 95%)' }}>
              Remover
            </button>
          )}
          <button onClick={salvar} disabled={salvando || !tipo || !taxa}
            className="flex-1 py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#0369a1' }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {salvando ? 'Salvando…' : 'Salvar sistema'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
