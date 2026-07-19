import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Droplets, FlaskConical, Shield, Leaf, ChevronDown } from 'lucide-react';

const PRAGAS = {
  alface: [
    { praga: 'Pulgões',       sintoma: 'Colônias nas folhas jovens; enrolamento',     controle: 'Imidacloprido (Confidor) 0,5g/L — pulverização foliar' },
    { praga: 'Mosca-branca',  sintoma: 'Manchas amarelas; fumagina',                  controle: 'Thiametoxam (Actara 250WG) 0,1g/L — horas frescas' },
    { praga: 'Tripes',        sintoma: 'Prateamento e deformação foliar',             controle: 'Spinosad (Success 480SC) 0,3 mL/L' },
    { praga: 'Lagartas',      sintoma: 'Buracos nas folhas',                          controle: 'Bacillus thuringiensis (Dipel) — biológico' },
    { praga: 'Cercosporiose', sintoma: 'Manchas circulares pardas',                   controle: 'Mancozebe (Dithane) 2,5g/L' },
    { praga: 'Míldio',        sintoma: 'Manchas amarelas + mofo branco abaixo',       controle: 'Metalaxil + Mancozebe (Ridomil Gold) 2g/L' },
  ],
  cebolinha: [
    { praga: 'Fusarium',  sintoma: 'Amarelecimento + tombamento',  controle: 'Rotação de culturas, drenagem adequada' },
    { praga: 'Tripes',    sintoma: 'Prateamento e deformação',     controle: 'Spinosad 0,3mL/L' },
  ],
  coentro: [
    { praga: 'Alternária', sintoma: 'Manchas escuras com halo amarelo', controle: 'Iprodiona 1,5g/L' },
    { praga: 'Pulgões',    sintoma: 'Colônias; mosqueado',              controle: 'Imidacloprido 0,5g/L' },
  ],
  quiabo: [
    { praga: 'Mosca-branca',       sintoma: 'Fumagina; vírus do amarelão',   controle: 'Thiametoxam 0,1g/L' },
    { praga: 'Broca do fruto',     sintoma: 'Frutos furados e apodrecidos',  controle: 'Carbaril 2g/L' },
    { praga: 'Podridão radicular', sintoma: 'Murcha e morte súbita',          controle: 'Drenagem + Metalaxil preventivo' },
  ],
  mandioca: [
    { praga: 'Mandarová',   sintoma: 'Desfolhamento por lagartas grandes',      controle: 'Bacillus thuringiensis ou coleta manual' },
    { praga: 'Ácaro-verde', sintoma: 'Folhas encarquilhadas e bronzeadas',      controle: 'Abamectina 0,5mL/L' },
  ],
  abacaxi: [
    { praga: 'Cochonilha-da-raiz', sintoma: 'Amarelecimento geral; murcha',         controle: 'Imidacloprido drench 0,5g/L' },
    { praga: 'Fusariose',          sintoma: 'Podridão na base das folhas centrais', controle: 'Propiconazol preventivo' },
  ],
};

function Section({ icon: Icon, title, accent, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3.5 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <div className="icon-circle w-8 h-8" style={{ background: `${accent}15`, color: accent }}>
            <Icon size={14} />
          </div>
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid hsl(140 13% 88%)', padding: '0 1rem 1rem' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start py-2.5" style={{ borderBottom: '1px solid hsl(140 13% 93%)' }}>
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-semibold text-right max-w-[55%] leading-relaxed ${highlight ? '' : 'text-foreground'}`}
        style={highlight ? { color: highlight } : {}}>
        {value}
      </span>
    </div>
  );
}

export default function ManejoAdubacao({ cultura, calc }) {
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';
  const pragas = PRAGAS[cultura.id] || [];
  const cor = cultura.cor;

  // ── Compute scale factor from calc state ──
  let fator = 1;
  if (calc) {
    const baseArea = isCampo
      ? (cultura.area?.padrao || 1)
      : (cultura.canteiro.comprimento * cultura.canteiro.largura);
    const currentArea = isCampo
      ? parseFloat(calc.area) || 1
      : (parseFloat(calc.comprimento) || cultura.canteiro.comprimento) * (parseFloat(calc.largura) || cultura.canteiro.largura);
    fator = currentArea / baseArea;
  }

  const scale = (val, decimals = 1) => {
    const v = val * fator;
    return v % 1 === 0 ? v.toFixed(0) : v.toFixed(decimals);
  };

  const isScaled = Math.abs(fator - 1) > 0.01;

  return (
    <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto space-y-2.5">

      {/* Scale notice */}
      {isScaled && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
          style={{ background: `${cor}10`, border: `1px solid ${cor}25` }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cor }} />
          <p className="text-[11px] font-semibold" style={{ color: cor }}>
            Doses ajustadas para {isCampo ? `${calc.area} ha` : `${calc.comprimento}×${calc.largura} m`}
            {' '}(fator {fator.toFixed(2)}×)
          </p>
        </div>
      )}

      <Section icon={Sprout} title="Preparo do Solo e Correção" accent={cor}>
        <div className="pt-2">
          <InfoRow label="Calcário dolomítico"
            value={`${scale(ins.calcareo.padrao)} ${ins.calcareo.unidade}`}
            highlight={isScaled ? cor : null} />
          <InfoRow label="Como aplicar" value="Lanço uniforme + incorporação com enxada" />
          <InfoRow label="Antecedência" value="15 a 30 dias antes do plantio" />
          <InfoRow label="pH alvo" value={cultura.pH} />
        </div>
      </Section>

      <Section icon={Leaf} title="Adubação de Plantio (Base)" accent={cor} defaultOpen>
        <div className="pt-2">
          <InfoRow label="Esterco bovino curtido"
            value={`${scale(ins.esterco.padrao)} ${ins.esterco.unidade}`}
            highlight={isScaled ? cor : null} />
          <InfoRow label={`NPK ${ins.npk.formula}`}
            value={`${scale(ins.npk.padrao, 2)} ${ins.npk.unidade}`}
            highlight={isScaled ? cor : null} />
          <InfoRow label="Como aplicar" value="Incorporar ao solo 7 dias antes do plantio" />
        </div>
      </Section>

      <Section icon={FlaskConical} title="Adubação de Cobertura" accent={cor}>
        <div className="pt-2">
          <InfoRow label="Ureia total"
            value={`${scale(ins.ureia.padrao, 0)} ${ins.ureia.unidade}`}
            highlight={isScaled ? cor : null} />
          {ins.ureia.parcelamento?.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl" style={{ border: '1px solid hsl(140 13% 88%)' }}>
              <div className="grid grid-cols-3 px-3 py-2"
                style={{ background: `${cor}12`, color: cor, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <span>Aplicação</span><span>Dia</span><span>Dose</span>
              </div>
              {ins.ureia.parcelamento.map((p, i) => (
                <div key={i} className="grid grid-cols-3 px-3 py-2 text-[12px]"
                  style={{ background: i % 2 === 0 ? 'white' : 'hsl(140 14% 98%)', borderTop: '1px solid hsl(140 13% 93%)' }}>
                  <span className="font-medium">{i + 1}ª cobertura</span>
                  <span className="text-muted-foreground">D{p.dia}{p.nota ? ` (${p.nota})` : ''}</span>
                  <span className="font-semibold" style={isScaled ? { color: cor } : {}}>
                    {(p.dose * fator).toFixed(0)} {isCampo ? 'kg' : 'g'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section icon={Droplets} title="Adubação Foliar" accent={cor}>
        <div className="pt-2">
          <InfoRow label="Nitrato de Cálcio"
            value={`${scale(ins.nitratoCalcio.padrao, 0)} ${ins.nitratoCalcio.unidade} — APÓS irrigação`}
            highlight={isScaled ? cor : null} />
          <InfoRow label="Aminoácidos"
            value={`${scale(ins.aminoacidos.padrao, 0)} ${ins.aminoacidos.unidade} — ANTES da chuva`}
            highlight={isScaled ? cor : null} />
          <InfoRow label="FTE BR-12"
            value={`${scale(ins.fte.padrao, 0)} ${ins.fte.unidade} — a cada 15 dias`}
            highlight={isScaled ? cor : null} />
        </div>
      </Section>

      <Section icon={Shield} title="Pragas e Doenças" accent={cor}>
        <div className="pt-3 space-y-2.5">
          {pragas.map((p, i) => (
            <div key={i} className="rounded-xl p-3"
              style={{ background: 'hsl(140 14% 98%)', border: '1px solid hsl(140 13% 90%)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cor }} />
                <span className="text-[12px] font-bold text-foreground">{p.praga}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-0.5 pl-3.5">{p.sintoma}</p>
              <p className="text-[11px] font-semibold pl-3.5" style={{ color: cor }}>{p.controle}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
