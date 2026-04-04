import React from 'react';
import { Card } from './ui/card';

export default function VisaoGeral({ cultura }) {
  const isCampo = cultura.tipo === 'campo';

  let gridItems;
  if (isCampo) {
    const plantasPorHa = Math.floor(10000 / (cultura.espacamento.linhas * cultura.espacamento.plantas));
    gridItems = [
      { label: 'Sistema',        value: 'Campo — por hectare' },
      { label: 'Área base',      value: cultura.areaPadrao },
      { label: 'Espaçamento',    value: cultura.espacamentoPadrao },
      { label: 'Plantas/ha',     value: plantasPorHa.toLocaleString('pt-BR') },
    ];
  } else {
    const area = cultura.canteiro.comprimento * cultura.canteiro.largura;
    const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
    const porLinha = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
    const totalPlantas = linhas * porLinha;
    gridItems = [
      { label: 'Área',             value: `${area} m²` },
      { label: 'Dimensões',        value: `${cultura.canteiro.comprimento}×${cultura.canteiro.largura} m` },
      { label: 'Plantas/canteiro', value: totalPlantas.toLocaleString('pt-BR') },
      { label: 'Equiv. em ha',     value: `~${Math.round(10000 / area)} canteiros/ha` },
    ];
  }

  const chips = [
    { label: `Solo: ${cultura.soloTipo}`,          color: cultura.cor },
    { label: `pH: ${cultura.pH}`,                  color: '#1a6b9a' },
    { label: `Água: ${cultura.necessidadeHidrica}`, color: '#1e4d2b' },
    { label: `Clima: ${cultura.clima}`,             color: '#b5451b' },
    { label: `Ciclo: ${cultura.ciclo}` },
  ];

  return (
    <div className="p-6">
      <div className="pb-5 mb-5 border-b border-borda">
        <p className="text-xs text-gray-400 italic mb-2">{cultura.nomesCientifico}</p>
        <p className="text-gray-600 leading-relaxed">{cultura.descricao}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {chips.map(c => (
          <span key={c.label} className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border"
            style={ c.color ? { backgroundColor: c.color + '15', color: c.color, borderColor: c.color + '40' }
              : { backgroundColor: '#f7f5f0', color: '#555', borderColor: '#e8e4de' }}>
            {c.label}
          </span>
        ))}
      </div>

      <h2 className="font-display font-semibold text-lg text-gray-800 mb-3">
        {isCampo ? 'Dados de Referência por Hectare' : 'Dados do Canteiro Padrão'}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {gridItems.map(item => (
          <Card key={item.label} className="p-4 text-center">
            <div className="text-xl font-display font-bold mb-1" style={{ color: cultura.cor }}>{item.value}</div>
            <div className="text-xs text-gray-400">{item.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
