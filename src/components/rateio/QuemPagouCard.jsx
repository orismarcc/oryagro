/**
 * QuemPagouCard — no lote: quanto cada sócio colocou nas despesas divididas,
 * em R$ e %, quanto já pagou, quanto falta e a diferença para a média.
 */
import React from 'react';
import { Scale } from 'lucide-react';
import { resumoPorSocio } from '../../lib/rateio';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function QuemPagouCard({ despesas, rateios, membros, cor }) {
  const r = resumoPorSocio(despesas, rateios, membros);
  if (!r.socios.length || r.totalDividido <= 0) return null;

  const media = r.totalDividido / r.socios.length;
  const empatado = r.socios.every(s => Math.abs(s.diferenca) < 0.01);

  return (
    <div className="card p-4 mb-5">
      <p className="section-label mb-1 flex items-center gap-1.5"><Scale size={13} /> Quem pagou o quê</p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Total dividido entre os sócios: <strong>{fmtBRL(r.totalDividido)}</strong> · média por sócio {fmtBRL(media)}
      </p>

      <div className="flex flex-col gap-3">
        {r.socios.map(s => {
          const dif = s.diferenca;
          const corDif = Math.abs(dif) < 0.01 ? 'hsl(150 8% 45%)' : dif > 0 ? 'hsl(152 60% 30%)' : 'hsl(28 85% 38%)';
          return (
            <div key={s.membroId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold truncate">{s.nome}</span>
                <span className="text-[13px] font-extrabold flex-shrink-0" style={{ color: cor }}>
                  {fmtBRL(s.parte)} <span className="text-[11px] font-bold text-muted-foreground">({fmtPct(s.percentual)})</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'hsl(140 14% 92%)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.percentual)}%`, background: cor }} />
              </div>
              <p className="text-[11px] mt-1 flex flex-wrap gap-x-3">
                <span style={{ color: 'hsl(152 60% 30%)' }}>Pago {fmtBRL(s.pago)}</span>
                {s.pendente > 0 && <span className="font-bold" style={{ color: 'hsl(28 85% 38%)' }}>Falta {fmtBRL(s.pendente)}</span>}
                <span style={{ color: corDif }}>
                  {Math.abs(dif) < 0.01 ? 'Igual à média' : `${dif > 0 ? '+' : '−'}${fmtBRL(Math.abs(dif))} ${dif > 0 ? 'acima' : 'abaixo'} da média`}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {!empatado && (
        <p className="text-[10.5px] text-muted-foreground mt-3">
          A diferença compara com a divisão em partes iguais. Se o combinado for outro (ex.: participação diferente no lote), ela é esperada.
        </p>
      )}
      {r.semDivisao > 0 && (
        <p className="text-[10.5px] text-muted-foreground mt-2">
          {fmtBRL(r.semDivisao)} em despesas sem divisão entre sócios (lançadas antes ou sem sócios marcados).
        </p>
      )}
    </div>
  );
}
