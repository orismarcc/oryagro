import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { interpretarSolo, montarPlanoAdubacao } from '../lib/analiseSolo';

/**
 * AnaliseSoloForm — painel opcional no cadastro do lote para informar a análise
 * de solo (painel essencial) + tipo de solo. Emite, via onChange, um objeto
 * { ativo, tipoSolo, analise } que o cadastro inclui no payload do plantio.
 *
 * Mostra uma prévia ao vivo (CTC, V%, saturação de Al, dose de calagem e
 * principais alertas) calculada pelo motor de interpretação.
 */

const CAMPOS = [
  { key: 'ph',     label: 'pH (CaCl₂)',        hint: 'Acidez. Ideal 5,5–6,5 (a maioria).', step: '0.1' },
  { key: 'p',      label: 'Fósforo P-resina',  hint: 'mg/dm³. Baixo < 12.',                step: '0.1', suf: 'mg/dm³' },
  { key: 'k',      label: 'Potássio (K)',      hint: 'mg/dm³. Médio 40–80.',               step: '0.1', suf: 'mg/dm³' },
  { key: 'ca',     label: 'Cálcio (Ca)',       hint: 'cmolc/dm³.',                          step: '0.1', suf: 'cmolc' },
  { key: 'mg',     label: 'Magnésio (Mg)',     hint: 'cmolc/dm³. Baixo < 0,5.',            step: '0.1', suf: 'cmolc' },
  { key: 'al',     label: 'Alumínio (Al)',     hint: 'cmolc/dm³. Tóxico quando alto.',     step: '0.1', suf: 'cmolc' },
  { key: 'hAl',    label: 'H + Al',            hint: 'cmolc/dm³ (acidez potencial).',      step: '0.1', suf: 'cmolc' },
  { key: 'mo',     label: 'Matéria orgânica',  hint: 'g/dm³. Ideal > 25.',                 step: '0.1', suf: 'g/dm³' },
  { key: 'zn',     label: 'Zinco (opcional)',  hint: 'mg/dm³. Baixo < 0,6.',               step: '0.1', suf: 'mg/dm³', opcional: true },
  { key: 'argila', label: 'Argila (opcional)', hint: '% — define a textura.',              step: '1',   suf: '%', opcional: true },
  { key: 'prnt',   label: 'PRNT do calcário',  hint: '% — padrão 80.',                     step: '1',   suf: '%' },
];

const TIPOS_SOLO = ['Arenoso', 'Franco-Arenoso', 'Franco', 'Franco-Argiloso', 'Argiloso'];
const fmt = (n, d = 1) => (n == null || !isFinite(n) ? '—' : n.toFixed(d).replace('.', ','));

export default function AnaliseSoloForm({ cultura, cor = '#16a34a', onChange }) {
  const [ativo, setAtivo]     = useState(false);
  const [aberto, setAberto]   = useState(false);
  const [tipoSolo, setTipoSolo] = useState('');
  const [analise, setAnalise] = useState({ prnt: '80' });

  // Emite o estado para o cadastro sempre que algo muda
  useEffect(() => {
    onChange?.({ ativo, tipoSolo: tipoSolo.trim(), analise });
  }, [ativo, tipoSolo, analise, onChange]);

  const set = (k, v) => setAnalise(a => ({ ...a, [k]: v }));

  // Prévia ao vivo — precisa de Ca, Mg, H+Al e pH no mínimo
  const preview = useMemo(() => {
    const temBase = ['ca', 'mg', 'hAl'].every(k => analise[k] != null && analise[k] !== '');
    if (!ativo || !temBase) return null;
    try {
      const interp = interpretarSolo(analise, cultura);
      const plano = montarPlanoAdubacao({ analise, cultura });
      return { interp, plano };
    } catch { return null; }
  }, [ativo, analise, cultura]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${cor}22` }}>
      {/* Cabeçalho / toggle */}
      <button
        type="button"
        onClick={() => { const n = !ativo; setAtivo(n); setAberto(n); }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ background: `${cor}0a` }}
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0" style={{ background: `${cor}18`, color: cor }}>
          <FlaskConical size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-foreground leading-tight">Análise de solo (opcional)</p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Monta a calagem e a adubação do cronograma pela sua análise
          </p>
        </div>
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ativo ? `${cor}1a` : 'hsl(210 16% 92%)', color: ativo ? cor : 'hsl(215 16% 50%)' }}>
            {ativo ? 'Ativa' : 'Desativada'}
          </span>
          {aberto ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {ativo && aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}
          >
            <div className="p-3 space-y-3">
              {/* Tipo de solo */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de solo</label>
                <input
                  type="text" value={tipoSolo} onChange={e => setTipoSolo(e.target.value)}
                  placeholder="Ex.: Franco-Arenoso"
                  className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
                  style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
                />
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {TIPOS_SOLO.map(t => (
                    <button key={t} type="button" onClick={() => setTipoSolo(t)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                      style={tipoSolo === t ? { background: cor, color: '#fff' } : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos numéricos */}
              <div className="grid grid-cols-2 gap-2">
                {CAMPOS.map(c => (
                  <div key={c.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground tracking-wide leading-tight">
                      {c.label}{c.suf ? ` (${c.suf})` : ''}
                    </label>
                    <input
                      type="number" inputMode="decimal" step={c.step}
                      value={analise[c.key] ?? ''} onChange={e => set(c.key, e.target.value)}
                      placeholder={c.opcional ? 'opcional' : '—'}
                      className="px-2.5 py-1.5 rounded-lg text-[13px] font-semibold outline-none"
                      style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
                    />
                    <span className="text-[9px] text-muted-foreground leading-tight">{c.hint}</span>
                  </div>
                ))}
              </div>

              {/* Prévia ao vivo */}
              {preview ? (
                <div className="rounded-xl p-3 space-y-2" style={{ background: `${cor}0a`, border: `1px solid ${cor}22` }}>
                  <p className="text-[11px] font-bold" style={{ color: cor }}>Prévia da interpretação</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Mini label="CTC" value={fmt(preview.interp.indices.ctc, 2)} />
                    <Mini label="V%" value={fmt(preview.interp.indices.v) + '%'} />
                    <Mini label="Sat. Al" value={fmt(preview.interp.indices.m) + '%'} />
                    <Mini label="Calagem" value={preview.plano.precisaCalagem ? `${fmt(preview.plano.calagem.adotada)} t/ha` : '—'} />
                  </div>
                  {preview.plano.diagnostico.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {preview.plano.diagnostico.slice(0, 3).map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-snug">
                          <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: cor }} />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] font-semibold pt-0.5" style={{ color: cor }}>
                    ✓ A adubação do cronograma será montada a partir desta análise.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                  <Info size={12} className="flex-shrink-0 mt-0.5" />
                  Preencha ao menos Ca, Mg e H+Al para ver a prévia (CTC, V%, calagem).
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{label}</p>
      <p className="text-[12px] font-bold text-foreground leading-tight mt-0.5">{value}</p>
    </div>
  );
}
