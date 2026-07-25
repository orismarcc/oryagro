/**
 * ComparacaoDireta.jsx — duelo de culturas lado a lado (ex.: maracujá × acerola).
 *
 * Duas colunas com o MESMO motor do simulador (useSimulador): inputs essenciais
 * editáveis por cultura e a tabela linha a linha — cada insumo, receita, custo,
 * lucro e margem — com destaque de quem vence em cada linha-chave.
 */
import React, { useState } from 'react';
import { CULTURAS, CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';
import { Swords, TrendingUp } from 'lucide-react';

const fmtBRL = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = (v) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR'));

// Ordem canônica das linhas de custo (mesmos nomes de composicaoCustos)
const CUSTOS_ORDEM = ['Calcário', 'Esterco', 'NPK', 'Ureia', 'Sementes/Mudas', 'Estacas', 'Arame',
  'Mão de Obra', 'Mulching', 'Embalagem', 'Transporte', 'Defensivos', 'Energia'];

function CulturaSelect({ value, onChange, exclude }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl border px-2 py-2 text-[13px] font-semibold bg-background outline-none"
      style={{ borderColor: `${CULTURAS[value]?.cor || '#16a34a'}55` }}>
      {CULTURAS_LIST.filter(c => c.id !== exclude).map(c => (
        <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>
      ))}
    </select>
  );
}

function MiniInput({ value, onChange, placeholder }) {
  return (
    <input type="number" step="0.1" value={value ?? ''} placeholder={placeholder}
      onChange={e => { const r = e.target.value; onChange(r === '' ? '' : parseFloat(r) || 0); }}
      className="w-full rounded-lg border px-2 py-1.5 text-[12.5px] text-center bg-background outline-none"
      style={{ borderColor: 'hsl(152 14% 82%)' }} />
  );
}

export default function ComparacaoDireta() {
  const [idA, setIdA] = useState('maracuja');
  const [idB, setIdB] = useState('acerola');
  const culturaA = CULTURAS[idA], culturaB = CULTURAS[idB];

  // Inputs editáveis por lado — campos vazios caem nos padrões da cultura
  const init = (c) => (c.tipo === 'campo' ? { areaHa: 1 } : {});
  const [valA, setValA] = useState(() => init(CULTURAS.maracuja));
  const [valB, setValB] = useState(() => init(CULTURAS.acerola));

  const pickA = (id) => { setIdA(id); setValA(init(CULTURAS[id])); };
  const pickB = (id) => { setIdB(id); setValB(init(CULTURAS[id])); };
  const setA = (k) => (v) => setValA(p => ({ ...p, [k]: v }));
  const setB = (k) => (v) => setValB(p => ({ ...p, [k]: v }));

  const rA = useSimulador(culturaA, valA);
  const rB = useSimulador(culturaB, valB);

  const corA = culturaA.cor, corB = culturaB.cor;
  const custoDe = (r, nome) => r.composicaoCustos.find(c => c.name === nome)?.value ?? 0;
  const linhasCusto = CUSTOS_ORDEM.filter(n => custoDe(rA, n) > 0 || custoDe(rB, n) > 0);

  // Inputs exibidos (por linha: label + campo A + campo B); campo vazio = padrão
  const inputs = [
    culturaA.tipo === 'campo' || culturaB.tipo === 'campo'
      ? { label: 'Área (ha)', kA: 'areaHa', kB: 'areaHa', phA: culturaA.area?.padrao, phB: culturaB.area?.padrao }
      : null,
    { label: 'Esp. linhas (m)', kA: 'espacamentoLinhas', kB: 'espacamentoLinhas',
      phA: culturaA.espacamento?.linhas ?? culturaA.canteiro?.espacamentoLinhas, phB: culturaB.espacamento?.linhas ?? culturaB.canteiro?.espacamentoLinhas },
    { label: 'Esp. plantas (m)', kA: 'espacamentoPlantas', kB: 'espacamentoPlantas',
      phA: culturaA.espacamento?.plantas ?? culturaA.canteiro?.espacamentoPlantas, phB: culturaB.espacamento?.plantas ?? culturaB.canteiro?.espacamentoPlantas },
    { label: `Preço venda (R$/${culturaA.venda.unidade}${culturaB.venda.unidade !== culturaA.venda.unidade ? ' · R$/' + culturaB.venda.unidade : ''})`,
      kA: 'precoVenda', kB: 'precoVenda', phA: culturaA.venda.precoUnitario, phB: culturaB.venda.precoUnitario },
    (culturaA.venda.producaoKgPorHa || culturaB.venda.producaoKgPorHa)
      ? { label: 'Produção (kg/ha)', kA: 'producaoKgPorHa', kB: 'producaoKgPorHa',
          phA: culturaA.venda.producaoKgPorHa, phB: culturaB.venda.producaoKgPorHa }
      : null,
    { label: 'Mão de obra (R$)', kA: 'modObra', kB: 'modObra',
      phA: culturaA.insumos?.modObra?.padrao, phB: culturaB.insumos?.modObra?.padrao },
  ].filter(Boolean);

  const vence = (a, b, maiorMelhor = true) => {
    if (a === b || a == null || b == null) return 0;
    return (maiorMelhor ? a > b : a < b) ? 1 : -1;
  };

  const Row = ({ label, va, vb, fmt = fmtBRL, melhor = null, forte = false }) => {
    const w = melhor == null ? 0 : vence(va, vb, melhor === 'maior');
    const cell = (v, win, cor) => (
      <td className={`py-1.5 px-1 text-right tabular-nums ${forte ? 'font-bold' : ''}`}
        style={win ? { color: cor, fontWeight: 700 } : {}}>
        {fmt(v)}{win ? ' ●' : ''}
      </td>
    );
    return (
      <tr style={{ borderTop: '1px solid hsl(150 14% 91%)' }}>
        <td className="py-1.5 pr-1 text-[11px] text-muted-foreground">{label}</td>
        {cell(va, w === 1, corA)}
        {cell(vb, w === -1, corB)}
      </tr>
    );
  };

  const difLucro = (rA.lucro ?? 0) - (rB.lucro ?? 0);
  const vencedor = difLucro === 0 ? null : (difLucro > 0 ? culturaA : culturaB);

  return (
    <div className="page-body pt-4 pb-8 flex flex-col gap-4">

      {/* Seleção do duelo */}
      <div className="card p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <CulturaSelect value={idA} onChange={pickA} exclude={idB} />
          <Swords size={16} className="text-muted-foreground" />
          <CulturaSelect value={idB} onChange={pickB} exclude={idA} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Campos vazios usam o padrão de cada cultura. {culturaA.tipo !== 'campo' || culturaB.tipo !== 'campo'
            ? 'Culturas de canteiro são calculadas por canteiro.' : 'Base: mesma área para as duas.'}
        </p>
      </div>

      {/* Inputs editáveis lado a lado */}
      <div className="card p-3">
        <p className="section-label mb-2">Parâmetros (editáveis)</p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground pb-1"> </th>
              <th className="text-center text-[10px] font-black pb-1" style={{ color: corA }}>{culturaA.emoji} {culturaA.nome}</th>
              <th className="text-center text-[10px] font-black pb-1" style={{ color: corB }}>{culturaB.emoji} {culturaB.nome}</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map(i => (
              <tr key={i.label}>
                <td className="py-1 pr-1 text-[11px] text-muted-foreground whitespace-nowrap">{i.label}</td>
                <td className="py-1 px-0.5"><MiniInput value={valA[i.kA]} onChange={setA(i.kA)} placeholder={i.phA != null ? String(i.phA) : ''} /></td>
                <td className="py-1 px-0.5"><MiniInput value={valB[i.kB]} onChange={setB(i.kB)} placeholder={i.phB != null ? String(i.phB) : ''} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela comparativa */}
      <div className="card p-3">
        <p className="section-label mb-1">Frente a frente</p>
        <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground py-1"> </th>
              <th className="text-right text-[10px] font-black py-1" style={{ color: corA }}>{culturaA.emoji} {culturaA.nome}</th>
              <th className="text-right text-[10px] font-black py-1" style={{ color: corB }}>{culturaB.emoji} {culturaB.nome}</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Plantas" va={rA.totalPlantas} vb={rB.totalPlantas} fmt={fmtNum} />
            <Row label={`Produção (${rA.unidadeVenda}${rB.unidadeVenda !== rA.unidadeVenda ? ' · ' + rB.unidadeVenda : ''})`} va={rA.producaoTotal} vb={rB.producaoTotal} fmt={fmtNum} />
            <Row label="Receita" va={rA.receita} vb={rB.receita} melhor="maior" forte />
            {linhasCusto.map(n => (
              <Row key={n} label={`− ${n}`} va={custoDe(rA, n)} vb={custoDe(rB, n)} />
            ))}
            <Row label="Custo total" va={rA.custoTotal} vb={rB.custoTotal} melhor="menor" forte />
            <Row label={`Lucro / ${rA.periodo === 'ano' || rB.periodo === 'ano' ? 'período' : 'ciclo'}`} va={rA.lucro} vb={rB.lucro} melhor="maior" forte />
            <Row label="Margem" va={rA.margem} vb={rB.margem} fmt={(v) => (v == null ? '—' : `${Math.round(v)}%`)} melhor="maior" />
            {(rA.paybackAno || rB.paybackAno) && (
              <Row label="Payback (anos)" va={rA.paybackAno} vb={rB.paybackAno} fmt={(v) => v ?? '—'} melhor="menor" />
            )}
          </tbody>
        </table>
      </div>

      {/* Veredito */}
      {vencedor && (
        <div className="card p-3.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${vencedor.cor}` }}>
          <span className="text-2xl">{vencedor.emoji}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
              <TrendingUp size={14} style={{ color: vencedor.cor }} />
              {vencedor.nome} lucra {fmtBRL(Math.abs(difLucro))} a mais
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              Nesta configuração. Períodos podem diferir (ciclo × ano) — considere também o payback e o seu mercado local.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
