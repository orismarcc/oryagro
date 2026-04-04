import React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { Sprout, Droplets, FlaskConical, Shield, Leaf } from 'lucide-react';

const PRAGAS = {
  alface: [
    { praga: 'Pulgões', sintoma: 'Colônias nas folhas jovens; enrolamento', controle: 'Imidacloprido (Confidor) 0,5g/L — pulverização foliar' },
    { praga: 'Mosca-branca', sintoma: 'Manchas amarelas; fumagina', controle: 'Thiametoxam (Actara 250WG) 0,1g/L — horas frescas' },
    { praga: 'Tripes', sintoma: 'Prateamento e deformação foliar', controle: 'Spinosad (Success 480SC) 0,3 mL/L' },
    { praga: 'Lagartas', sintoma: 'Buracos nas folhas', controle: 'Bacillus thuringiensis (Dipel) — biológico' },
    { praga: 'Cercosporiose', sintoma: 'Manchas circulares pardas', controle: 'Mancozebe (Dithane) 2,5g/L' },
    { praga: 'Míldio', sintoma: 'Manchas amarelas + mofo branco abaixo', controle: 'Metalaxil + Mancozebe (Ridomil Gold) 2g/L' },
  ],
  cebolinha: [
    { praga: 'Fusarium', sintoma: 'Amarelecimento + tombamento', controle: 'Rotação de culturas, drenagem adequada' },
    { praga: 'Tripes', sintoma: 'Prateamento e deformação', controle: 'Spinosad 0,3mL/L' },
  ],
  coentro: [
    { praga: 'Alternária', sintoma: 'Manchas escuras com halo amarelo', controle: 'Iprodiona 1,5g/L' },
    { praga: 'Pulgões', sintoma: 'Colônias; mosqueado', controle: 'Imidacloprido 0,5g/L' },
  ],
  quiabo: [
    { praga: 'Mosca-branca', sintoma: 'Fumagina; vírus do amarelão', controle: 'Thiametoxam 0,1g/L' },
    { praga: 'Broca do fruto', sintoma: 'Frutos furados e apodrecidos', controle: 'Carbaril 2g/L' },
    { praga: 'Podridão radicular', sintoma: 'Murcha e morte súbita', controle: 'Drenagem + Metalaxil preventivo' },
  ],
  mandioca: [
    { praga: 'Mandarová', sintoma: 'Desfolhamento por lagartas grandes', controle: 'Bacillus thuringiensis ou coleta manual' },
    { praga: 'Ácaro-verde', sintoma: 'Folhas encarquilhadas e bronzeadas', controle: 'Abamectina 0,5mL/L' },
  ],
  abacaxi: [
    { praga: 'Cochonilha-da-raiz', sintoma: 'Amarelecimento geral; murcha', controle: 'Imidacloprido drench 0,5g/L' },
    { praga: 'Fusariose', sintoma: 'Podridão na base das folhas centrais', controle: 'Propiconazol preventivo' },
  ],
};

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-borda/60 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function ManejoAdubacao({ cultura }) {
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';
  const pragas = PRAGAS[cultura.id] || [];

  return (
    <div className="p-6 space-y-2">
      <Accordion type="multiple" defaultValue={['base']}>
        <AccordionItem value="solo">
          <AccordionTrigger>
            <Sprout size={16} className="text-verde-700" />
            Preparo do Solo e Correção
          </AccordionTrigger>
          <AccordionContent>
            <InfoRow label="Calcário dolomítico" value={`${ins.calcareo.padrao} ${ins.calcareo.unidade}`} />
            <InfoRow label="Como aplicar" value="Lanço uniforme + incorporação com enxada" />
            <InfoRow label="Antecedência" value="15 a 30 dias antes do plantio" />
            <InfoRow label="pH alvo" value={cultura.pH} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="base">
          <AccordionTrigger>
            <Leaf size={16} className="text-verde-700" />
            Adubação de Plantio (Base)
          </AccordionTrigger>
          <AccordionContent>
            <InfoRow label="Esterco bovino curtido" value={`${ins.esterco.padrao} ${ins.esterco.unidade}`} />
            <InfoRow label={`NPK ${ins.npk.formula}`} value={`${ins.npk.padrao} ${ins.npk.unidade}`} />
            <InfoRow label="Como aplicar" value="Incorporar ao solo 7 dias antes do plantio" />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cobertura">
          <AccordionTrigger>
            <FlaskConical size={16} className="text-verde-700" />
            Adubação de Cobertura
          </AccordionTrigger>
          <AccordionContent>
            <InfoRow label="Ureia total" value={`${ins.ureia.padrao} ${ins.ureia.unidade}`} />
            {ins.ureia.parcelamento?.length > 0 && (
              <table className="w-full mt-2 text-sm">
                <thead>
                  <tr className="bg-verde-800 text-white text-xs">
                    <th className="text-left px-3 py-2 rounded-tl">Aplicação</th>
                    <th className="text-left px-3 py-2">Dia</th>
                    <th className="text-left px-3 py-2 rounded-tr">Dose</th>
                  </tr>
                </thead>
                <tbody>
                  {ins.ureia.parcelamento.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-papel'}>
                      <td className="px-3 py-1.5">{i + 1}ª cobertura</td>
                      <td className="px-3 py-1.5">Dia {p.dia}{p.nota ? ` (${p.nota})` : ''}</td>
                      <td className="px-3 py-1.5">{p.dose} {isCampo ? 'kg' : 'g'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="foliar">
          <AccordionTrigger>
            <Droplets size={16} className="text-verde-700" />
            Adubação Foliar
          </AccordionTrigger>
          <AccordionContent>
            <InfoRow label="Nitrato de Cálcio" value={`${ins.nitratoCalcio.padrao} ${ins.nitratoCalcio.unidade} — APÓS irrigação`} />
            <InfoRow label="Aminoácidos" value={`${ins.aminoacidos.padrao} ${ins.aminoacidos.unidade} — ANTES da chuva`} />
            <InfoRow label="FTE BR-12" value={`${ins.fte.padrao} ${ins.fte.unidade} — a cada 15 dias`} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pragas">
          <AccordionTrigger>
            <Shield size={16} className="text-verde-700" />
            Controle Preventivo — Pragas e Doenças
          </AccordionTrigger>
          <AccordionContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-verde-800 text-white text-xs">
                  <th className="text-left px-3 py-2 rounded-tl">Praga/Doença</th>
                  <th className="text-left px-3 py-2">Sintoma</th>
                  <th className="text-left px-3 py-2 rounded-tr">Controle</th>
                </tr>
              </thead>
              <tbody>
                {pragas.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-papel'}>
                    <td className="px-3 py-2 font-semibold">{p.praga}</td>
                    <td className="px-3 py-2 text-gray-600">{p.sintoma}</td>
                    <td className="px-3 py-2 text-gray-700">{p.controle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
