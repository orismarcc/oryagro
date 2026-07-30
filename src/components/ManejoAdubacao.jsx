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
  // Maracujá — referência: Guia Definitivo do Maracujá (Horta Minas), caps. 12 e 13.
  // Doses por bomba de 20 L. Uso de agrotóxico exige receituário agronômico:
  // confira sempre dose, carência e EPI no rótulo do produto.
  maracuja: [
    { praga: 'Mosca do botão floral', sintoma: 'Larvas dentro do botão; botão cai antes de abrir',       controle: 'Connect 20 mL (fase de botão) ou Cypermil 25 mL + armadilhas e eliminação dos botões atacados' },
    { praga: 'Mosca das frutas',      sintoma: 'Picada no fruto; larvas apodrecem a polpa',              controle: 'Armadilha McPhail para monitorar + iscas tóxicas (melaço + inseticida) na bordadura' },
    { praga: 'Tripes',                sintoma: 'Prateamento e deformação das folhas novas',              controle: 'Dicarzol 20 g — aplicação preventiva' },
    { praga: 'Cigarrinha / pulgão',   sintoma: 'Sugadores; pulgão transmite a virose do endurecimento',  controle: 'Actara 20 g (sistêmico) — controlar pulgão é prevenir virose' },
    { praga: 'Ácaros',                sintoma: 'Folha bronzeada/amarelada e desfolha precoce (seca)',    controle: 'Acaricida específico (abamectina, enxofre)' },
    { praga: 'Lagartas',              sintoma: 'Folhas perfuradas; vivem em grupos',                     controle: 'Bacillus thuringiensis (biológico, muito eficiente) ou Cypermil 25 mL' },
    { praga: 'Percevejos',            sintoma: 'Injetam toxina; fruto deforma e cai',                    controle: 'Decis 20 mL ou neem 60 mL + detergente neutro 100 mL — aplicar SEMPRE ao anoitecer (praga noturna)' },
    { praga: 'Antracnose',            sintoma: 'Manchas escuras e deprimidas em folhas e frutos',        controle: 'Manzate WG 40 g ou Cercobin 20 g — alternar os princípios ativos' },
    { praga: 'Verrugose',             sintoma: 'Crostas ásperas ("verrugas") no fruto jovem',            controle: 'Fungicida preventivo; polpa em geral não é afetada (serve para indústria)' },
    { praga: 'Fungos e bactérias',    sintoma: 'Lesões diversas em folhas e ramos',                       controle: 'Kasumin 25 mL — aplicação preventiva' },
    { praga: 'Fusariose (murcha)',    sintoma: 'Planta murcha e morre rapidamente — NÃO tem cura',       controle: 'Prevenção: solo drenado, muda sadia, não ferir raízes e NUNCA replantar maracujá na mesma área sem rotação' },
    { praga: 'Virose (endurecimento)', sintoma: 'Fruto duro e deformado, sem polpa; folha com mosaico',  controle: 'Sem cura: erradicar a planta doente, controlar pulgões e usar muda certificada' },
  ],
  // Melancia (Citrullus lanatus, cv. Liverpool) — agronomia geral da cultura.
  // Uso de agrotóxico exige receituário; poupe as abelhas (não pulverizar na florada).
  melancia: [
    { praga: 'Mosca-branca',        sintoma: 'Sugadora; transmite viroses (mosaico, amarelões)',          controle: 'Monitorar cedo; inseticida sistêmico conforme receituário — controlar é prevenir a virose' },
    { praga: 'Pulgões',             sintoma: 'Colônias nas folhas novas; também transmitem vírus',         controle: 'Controle na primeira infestação; preservar inimigos naturais' },
    { praga: 'Broca-das-cucurbitáceas', sintoma: 'Lagarta (Diaphania) fura ramas e frutos',              controle: 'Monitorar; Bacillus thuringiensis (biológico) ou inseticida específico ao anoitecer' },
    { praga: 'Tripes / ácaros',     sintoma: 'Prateamento e bronzeamento das folhas (épocas secas)',      controle: 'Acaricida/inseticida específico; manejo da irrigação' },
    { praga: 'Oídio',               sintoma: 'Mofo branco pulverulento sobre as folhas',                   controle: 'Enxofre ou fungicida específico; arejar a lavoura' },
    { praga: 'Míldio',              sintoma: 'Manchas amareladas na face superior, mofo por baixo',        controle: 'Fungicida preventivo (cobre/mancozebe); evitar molhar as folhas' },
    { praga: 'Antracnose',          sintoma: 'Lesões escuras e deprimidas em folhas e frutos',             controle: 'Fungicida à base de cobre/mancozebe; alternar princípios ativos' },
    { praga: 'Crestamento-gomoso',  sintoma: 'Cancros nas ramas com goma; podridão dos frutos',            controle: 'Semente sadia, rotação e fungicida preventivo; evitar ferimentos' },
    { praga: 'Fusariose (murcha)',  sintoma: 'Planta murcha e morre — doença de solo, NÃO tem cura',       controle: 'Prevenção: solo drenado, rotação de cultura e NUNCA repetir cucurbitácea na mesma área' },
    { praga: 'Coração-oco / rachadura', sintoma: 'Rachadura interna, casca grossa, sabor ruim (carência de boro)', controle: 'Não é praga: corrigir com boro (solo + foliar) e cálcio; ajustar a irrigação' },
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

/**
 * Programa nutricional detalhado da cultura (quando existe em
 * cultura.programaNutricional): mostra cada produto com a DOSE e, principalmente,
 * a FUNÇÃO — para o produtor entender o porquê de cada aplicação.
 */
function ProgramaNutricional({ programa, accent }) {
  return (
    <div className="pt-2 space-y-4">
      {programa.blocos.map((bloco) => (
        <div key={bloco.titulo}>
          <p className="text-[11.5px] font-bold text-foreground">{bloco.titulo}</p>
          {bloco.nota && (
            <p className="text-[10.5px] mt-1 rounded-lg px-2.5 py-1.5 leading-snug"
              style={{ background: 'hsl(38 90% 96%)', color: '#92400e', border: '1px solid hsl(38 85% 88%)' }}>
              {bloco.nota}
            </p>
          )}
          <div className="mt-2 space-y-2">
            {bloco.itens.map((item) => (
              <div key={item.produto} className="rounded-xl p-2.5"
                style={{ background: `${accent}0a`, border: `1px solid ${accent}20` }}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-[12px] font-bold text-foreground">{item.produto}</span>
                  <span className="text-[11px] font-semibold" style={{ color: accent }}>{item.dose}</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">{item.funcao}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {programa.observacao && (
        <p className="text-[10px] text-muted-foreground/80 leading-snug">{programa.observacao}</p>
      )}
      {programa.referencia && (
        <p className="text-[10px] text-muted-foreground/70">Referência: {programa.referencia}</p>
      )}
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

      {/* Programa nutricional detalhado (culturas com referência técnica) */}
      {cultura.programaNutricional && (
        <Section icon={FlaskConical} title="Programa nutricional completo" accent={cor} defaultOpen>
          <ProgramaNutricional programa={cultura.programaNutricional} accent={cor} />
        </Section>
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
          {/* Uso de agrotóxico é regulado (Lei 7.802/1989) — o app não substitui receituário. */}
          <p className="text-[10px] leading-snug rounded-lg px-2.5 py-2"
            style={{ background: 'hsl(38 90% 96%)', color: '#92400e', border: '1px solid hsl(38 85% 88%)' }}>
            Produtos citados são referência técnica, não prescrição. A aplicação de agrotóxico exige
            <strong> receituário agronômico</strong>: confirme dose, alvo, carência e EPI no rótulo do
            produto e registre cada aplicação no Caderno de Campo.
          </p>
        </div>
      </Section>
    </div>
  );
}
