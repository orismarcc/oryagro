import React from 'react';
import { Droplets, Thermometer, Leaf, FlaskConical, Clock } from 'lucide-react';

const CHIP_ICONS = {
  'Solo': Leaf,
  'pH': FlaskConical,
  'Água': Droplets,
  'Clima': Thermometer,
  'Ciclo': Clock,
};

export default function VisaoGeral({ cultura }) {
  const isCampo = cultura.tipo === 'campo';

  let stats;
  if (isCampo) {
    const plantasPorHa = Math.floor(10000 / (cultura.espacamento.linhas * cultura.espacamento.plantas));
    stats = [
      { label: 'Sistema',      value: 'Campo', sub: 'plantio a campo aberto', num: false },
      { label: 'Área base',    value: cultura.areaPadrao, sub: 'referência padrão', num: false },
      { label: 'Espaçamento',  value: cultura.espacamentoPadrao, sub: 'entre linhas × plantas', num: false },
      { label: 'Plantas/ha',   value: plantasPorHa.toLocaleString('pt-BR'), sub: 'densidade máxima', num: true },
    ];
  } else {
    const area = cultura.canteiro.comprimento * cultura.canteiro.largura;
    const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
    const porLinha = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
    const totalPlantas = linhas * porLinha;
    stats = [
      { label: 'Área/canteiro',      value: `${area} m²`, sub: 'área de cultivo', num: false },
      { label: 'Dimensões',          value: `${cultura.canteiro.comprimento}×${cultura.canteiro.largura} m`, sub: 'comprimento × largura', num: false },
      { label: 'Plantas/canteiro',   value: totalPlantas.toLocaleString('pt-BR'), sub: `${linhas} fil. × ${porLinha} plantas`, num: true },
      { label: 'Equiv. em ha',       value: `~${Math.round(10000 / area)}`, sub: 'canteiros por hectare', num: true },
    ];
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`stat-card anim-fade-up delay-${i * 50}`}
          >
            {/* Color top accent */}
            <div className="h-1 w-full" style={{ background: cultura.cor }} />
            <div className="p-4">
              {s.num ? (
                <div className="num-highlight text-2xl mb-0.5 anim-count-up" style={{ color: cultura.cor }}>
                  {s.value}
                </div>
              ) : (
                <div className="text-[15px] font-bold text-gray-800 mb-0.5 leading-snug">{s.value}</div>
              )}
              <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</div>
              <div className="text-[10px] text-gray-300 mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── About section ── */}
      <div className="grid md:grid-cols-[1fr_280px] gap-5">
        {/* Description */}
        <div
          className="rounded-xl p-6 border anim-fade-up delay-200"
          style={{
            background: `linear-gradient(135deg, ${cultura.cor}08, transparent)`,
            borderColor: `${cultura.cor}25`,
          }}
        >
          <div
            className="text-[10px] font-bold tracking-[2px] uppercase mb-2"
            style={{ color: cultura.cor }}
          >
            Sobre a Cultura
          </div>
          <p className="text-gray-600 leading-relaxed text-[14px]">
            {cultura.descricao}
          </p>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: `${cultura.cor}20` }}>
            <span className="text-xs italic text-gray-400">{cultura.nomesCientifico}</span>
          </div>
        </div>

        {/* Info chips vertical */}
        <div className="flex flex-col gap-2 anim-fade-up delay-250">
          {[
            { prefix: 'Solo',  value: cultura.soloTipo,           Icon: Leaf },
            { prefix: 'pH',    value: cultura.pH,                  Icon: FlaskConical },
            { prefix: 'Água',  value: cultura.necessidadeHidrica,  Icon: Droplets },
            { prefix: 'Clima', value: cultura.clima,               Icon: Thermometer },
            { prefix: 'Ciclo', value: cultura.ciclo,               Icon: Clock },
          ].map(({ prefix, value, Icon }) => (
            <div
              key={prefix}
              className="flex items-center gap-3 rounded-lg px-4 py-3 bg-white border border-borda"
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `${cultura.cor}14` }}
              >
                <Icon size={13} style={{ color: cultura.cor }} />
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-gray-300">{prefix}</div>
                <div className="text-[12px] font-semibold text-gray-700 leading-tight">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
