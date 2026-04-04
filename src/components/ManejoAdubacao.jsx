import React from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GrainIcon from '@mui/icons-material/Grain';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ShieldIcon from '@mui/icons-material/Shield';
import ScienceIcon from '@mui/icons-material/Science';
import YardIcon from '@mui/icons-material/Yard';

const PRAGAS = {
  alface: [
    { praga: 'Pulgões', sintoma: 'Colônias nas folhas jovens; enrolamento', controle: 'Imidacloprido 0,5g/L ou Thiametoxam 0,1g/L' },
    { praga: 'Mosca-branca', sintoma: 'Manchas amarelas; fumagina', controle: 'Thiametoxam (Actara 250WG) 0,1g/L' },
    { praga: 'Tripes', sintoma: 'Prateamento e deformação foliar', controle: 'Spinosad (Success 480SC) 0,3mL/L' },
    { praga: 'Lagartas', sintoma: 'Buracos nas folhas', controle: 'Bacillus thuringiensis (biológico)' },
    { praga: 'Cercosporiose', sintoma: 'Manchas circulares pardas', controle: 'Mancozebe (Dithane) 2,5g/L' },
    { praga: 'Míldio', sintoma: 'Manchas amarelas + mofo branco abaixo', controle: 'Metalaxil + Mancozebe (Ridomil Gold) 2g/L' },
  ],
  cebolinha: [
    { praga: 'Fusarium', sintoma: 'Amarelecimento + tombamento', controle: 'Rotação de culturas, drenagem adequada' },
    { praga: 'Tripes', sintoma: 'Prateamento e deformação', controle: 'Spinosad 0,3mL/L' },
    { praga: 'Míldio', sintoma: 'Manchas acinzentadas', controle: 'Metalaxil + Mancozebe 2g/L' },
  ],
  coentro: [
    { praga: 'Alternária', sintoma: 'Manchas escuras com halo amarelo', controle: 'Iprodiona 1,5g/L' },
    { praga: 'Pulgões', sintoma: 'Colônias; mosqueado', controle: 'Imidacloprido 0,5g/L' },
    { praga: 'Damping-off', sintoma: 'Tombamento de plântulas', controle: 'Substrato tratado, boa drenagem' },
  ],
  quiabo: [
    { praga: 'Mosca-branca', sintoma: 'Fumagina; vírus do amarelão', controle: 'Thiametoxam 0,1g/L' },
    { praga: 'Broca do fruto', sintoma: 'Frutos furados e apodrecidos', controle: 'Carbaril 2g/L' },
    { praga: 'Podridão radicular', sintoma: 'Murcha e morte súbita', controle: 'Drenagem + Metalaxil preventivo' },
  ],
  mandioca: [
    { praga: 'Mandarová', sintoma: 'Desfolhamento por lagartas grandes', controle: 'Bacillus thuringiensis ou coleta manual' },
    { praga: 'Ácaro-verde', sintoma: 'Folhas encarquilhadas e bronzeadas', controle: 'Abamectina 0,5mL/L' },
    { praga: 'Podridão radicular', sintoma: 'Raízes apodrecidas (fungos/bactérias)', controle: 'Rotação de culturas, sementes sadias' },
  ],
  abacaxi: [
    { praga: 'Cochonilha-da-raiz', sintoma: 'Amarelecimento geral; murcha', controle: 'Imidacloprido drench 0,5g/L' },
    { praga: 'Fusariose', sintoma: 'Podridão na base das folhas centrais', controle: 'Evitar ferimentos; Propiconazol preventivo' },
    { praga: 'Nematoides', sintoma: 'Galhas nas raízes; crescimento irregular', controle: 'Nematicidas + rotação com gramíneas' },
  ],
};

function AccSection({ icon: Icon, title, children }) {
  return (
    <Accordion sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Icon sx={{ color: '#1e4d2b', fontSize: 20 }} />
          <Typography fontWeight={700}>{title}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #f0ede8' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function ManejoAdubacao({ cultura }) {
  const ins = cultura.insumos;
  const area = cultura.canteiro.comprimento * cultura.canteiro.largura;
  const pragas = PRAGAS[cultura.id] || [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <AccSection icon={YardIcon} title="Preparo do Solo e Correção">
        <InfoRow label="Calcário dolomítico" value={`${ins.calcareo.padrao} kg/canteiro (${ins.calcareo.porM2 * area} kg)`} />
        <InfoRow label="Como aplicar" value="Lanço uniforme + incorporação com enxada" />
        <InfoRow label="Antecedência" value="15 a 30 dias antes do plantio" />
        <InfoRow label="pH alvo" value={cultura.pH} />
      </AccSection>

      <AccSection icon={GrainIcon} title="Adubação de Plantio (Base)">
        <InfoRow label="Esterco bovino curtido" value={`${ins.esterco.padrao} kg (${ins.esterco.porM2} kg/m²)`} />
        <InfoRow label={`NPK ${ins.npk.formula}`} value={`${ins.npk.padrao} kg (${ins.npk.porM2} kg/m²)`} />
        <InfoRow label="Como aplicar" value="Incorporar ao solo 7 dias antes do plantio" />
      </AccSection>

      <AccSection icon={ScienceIcon} title="Adubação de Cobertura">
        <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
          Ureia — total: {ins.ureia.padrao} {ins.ureia.unidade}
        </Typography>
        {ins.ureia.parcelamento?.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Aplicação</TableCell>
                <TableCell>Dia após transplante</TableCell>
                <TableCell>Dose</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ins.ureia.parcelamento.map((p, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}ª cobertura</TableCell>
                  <TableCell>Dia {p.dia}{p.nota ? ` (${p.nota})` : ''}</TableCell>
                  <TableCell>{p.dose} g</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AccSection>

      <AccSection icon={WaterDropIcon} title="Adubação Foliar">
        <InfoRow label="Nitrato de Cálcio" value={`${ins.nitratoCalcio.padrao} ${ins.nitratoCalcio.unidade} — Aplicar APÓS chuva/irrigação`} />
        <InfoRow label="Aminoácidos" value={`${ins.aminoacidos.padrao} ${ins.aminoacidos.unidade} — Aplicar ANTES da chuva/irrigação`} />
        <InfoRow label="FTE BR-12 (micronutrientes)" value={`${ins.fte.padrao} ${ins.fte.unidade} — a cada 15 dias`} />
      </AccSection>

      <AccSection icon={ShieldIcon} title="Controle Preventivo — Pragas e Doenças">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Praga/Doença</TableCell>
              <TableCell>Sintoma</TableCell>
              <TableCell>Controle</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pragas.map((p, i) => (
              <TableRow key={i}>
                <TableCell sx={{ fontWeight: 600 }}>{p.praga}</TableCell>
                <TableCell>{p.sintoma}</TableCell>
                <TableCell>{p.controle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccSection>
    </Box>
  );
}
