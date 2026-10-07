/**
 * GuiaCultura.jsx — guia técnico da cultura (somente CONSULTA).
 *
 * Mostra o que o guia recomenda (viveiro, campo, adubação, manejo) com a dose
 * como está no guia + o TOTAL para o lote escolhido (quando a dose é por
 * planta/cova ou por hectare) e a data que cada etapa teria nesse lote. Nada aqui é gravado: cada etapa tem um botão
 * para levá-la ao Anotar (agendar ou registrar como feita) com um toque.
 *
 * Substitui o antigo CronogramaTimeline, que marcava etapas e mexia no
 * estoque — isso agora é só do Anotar (registro do produtor).
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CalendarClock, CheckCircle2, BookOpen } from 'lucide-react';
import { montarPlanoAdubacao } from '../lib/analiseSolo';
import { hojeLocalISO } from '../hooks/useAtividades';
import { useAnotar } from '../context/AnotarContext';
import { somaDias, totalNoLote, categoriaDaEtapa } from '../lib/guia';

const TIPO_META = {
  plantio:   { color: '#059669', emoji: '🌱', label: 'Plantio' },
  adubo:     { color: '#d97706', emoji: '🧪', label: 'Adubação' },
  foliar:    { color: '#2563eb', emoji: '🌿', label: 'Foliar' },
  colheita:  { color: '#dc2626', emoji: '🌾', label: 'Colheita' },
  manejo:    { color: '#7c3aed', emoji: '🔧', label: 'Manejo' },
  especial:  { color: '#db2777', emoji: '⭐', label: 'Especial' },
  aplicacao: { color: '#7c3aed', emoji: '🛡️', label: 'Aplicação' },
};

const fmtBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

export default function GuiaCultura({ cultura, lotes = [] }) {
  const { anotar } = useAnotar();
  const lotesAtivos = lotes.filter(l => !l.status || l.status === 'ativo');
  const [loteId, setLoteId] = useState(lotesAtivos[0]?.id ?? null);
  const [metodoKey, setMetodoKey] = useState(cultura.metodosPropagacao?.[0]?.key ?? null);
  const [aberta, setAberta] = useState(null);

  const lote = lotesAtivos.find(l => l.id === loteId) || null;
  const metodo = (cultura.metodosPropagacao || [])
    .find(m => m.key === (lote ? lote.metodo_propagacao : metodoKey)) || null;
  const cor = cultura.cor;
  const hoje = hojeLocalISO();
  const isCampo = cultura.tipo === 'campo';

  const plantas = lote?.total_plantas || 0;
  const areaHa = isCampo ? (parseFloat(lote?.area_ha) || 0) : 0;
  const total = (dose) => totalNoLote(dose, { plantas, areaHa });

  const etapas = useMemo(() => {
    const diasViveiro = metodo?.diasViveiro || 0;
    const primeiraProducao = metodo?.lifecycle?.diasPrimeiraProducao ?? null;
    const maxDia = Math.max(0, ...cultura.cronograma.map(e => e.dia));
    // Culturas com guia completo (ex.: maracujá) mantêm os intervalos exatos;
    // nas demais o ciclo do guia é ajustado ao ciclo do método de propagação.
    const diaNoLote = (d) => (!primeiraProducao || !maxDia || cultura.cronogramaGuiaCompleto
      ? d + diasViveiro
      : Math.round(diasViveiro + (d / maxDia) * (primeiraProducao - diasViveiro)));

    const plano = lote?.analise_solo && !cultura.cronogramaGuiaCompleto
      ? montarPlanoAdubacao({ analise: lote.analise_solo, cultura, lote })
      : null;
    const viveiro = metodo?.etapasViveiro || [];
    const temTransplante = viveiro.some(e => e.tipo === 'especial');

    const lista = [
      ...viveiro.filter(e => !plano || e.tipo !== 'adubo').map(e => ({ ...e, fase: 'viveiro' })),
      ...(plano?.etapas || []).map(e => ({ ...e, dia: diasViveiro + e.offset, fase: 'campo', soloLote: true })),
      ...cultura.cronograma
        .filter(e => !(temTransplante && e.dia === 0 && e.tipo === 'plantio'))
        .filter(e => !plano || e.tipo !== 'adubo')
        .map(e => ({ ...e, dia: diaNoLote(e.dia), fase: 'campo' })),
    ].sort((a, b) => a.dia - b.dia);
    return { lista, plano };
  }, [cultura, metodo, lote]);

  const levarAoAnotar = (e, data) => {
    const dose = e.dose;
    const tot = e.soloLote ? null : total(e.dose);  // o plano da análise já vem calculado p/ o lote
    anotar({
      loteId: lote.id,
      agendado: data > hoje,
      data,
      preenchido: {
        etapa: e.etapa,
        categoria: categoriaDaEtapa(e),
        produto: e.produto && e.produto !== '—' ? e.produto : '',
        observacao: [dose && dose !== '—' ? `Dose: ${dose}` : null, tot ? `Total no lote: ${tot}` : null, e.forma]
          .filter(Boolean).join(' · '),
      },
    });
  };

  const grupos = [
    { titulo: 'Preparo e viveiro', itens: etapas.lista.filter(e => e.fase === 'viveiro') },
    { titulo: 'Campo', itens: etapas.lista.filter(e => e.fase === 'campo') },
  ].filter(g => g.itens.length);

  return (
    <div className="px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }}>
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl mb-4" style={{ background: `${cor}0d`, border: `1px solid ${cor}26` }}>
        <BookOpen size={16} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-foreground/80 leading-snug">
          <strong>Guia de referência.</strong> Nada aqui é registrado. Use <strong>Agendar</strong> ou <strong>Já fiz</strong> em
          uma etapa para levá-la ao seu lote.
        </p>
      </div>

      {/* Lote (ajusta doses e datas) ou método de propagação */}
      {lotesAtivos.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: 'none' }}>
          {lotesAtivos.map(l => (
            <Chip key={l.id} on={l.id === loteId} cor={cor} onClick={() => setLoteId(l.id)}>{l.nome}</Chip>
          ))}
          <Chip on={!loteId} cor={cor} onClick={() => setLoteId(null)}>Sem lote</Chip>
        </div>
      ) : null}
      {!lote && (cultura.metodosPropagacao || []).length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {cultura.metodosPropagacao.map(m => (
            <Chip key={m.key} on={m.key === metodoKey} cor={cor} onClick={() => setMetodoKey(m.key)}>{m.label}</Chip>
          ))}
        </div>
      )}
      {lote && (
        <p className="text-[11px] text-muted-foreground mb-4">
          Totais calculados para {[areaHa ? `${String(areaHa).replace('.', ',')} ha` : null, plantas ? `${plantas.toLocaleString('pt-BR')} plantas` : null].filter(Boolean).join(' · ') || 'o lote'}
          {' '}· datas a partir de {fmtBR(lote.data_plantio)}.
        </p>
      )}

      {etapas.plano && <PlanoAduboCard plano={etapas.plano} lote={lote} cor={cor} />}

      {grupos.map(g => (
        <div key={g.titulo} className="mb-5">
          <p className="section-label mb-2">{g.titulo} · {g.itens.length}</p>
          <div className="card overflow-hidden">
            {g.itens.map((e, i) => {
              const meta = TIPO_META[e.tipo] || TIPO_META.manejo;
              const chave = `${g.titulo}-${i}-${e.etapa}`;
              const data = lote ? somaDias(lote.data_plantio, e.dia) : null;
              const dose = e.dose;
              const tot = e.soloLote ? null : total(e.dose);  // o plano da análise já vem calculado p/ o lote
              const expandida = aberta === chave;
              return (
                <div key={chave} style={{ borderBottom: i < g.itens.length - 1 ? '1px solid hsl(140 13% 93%)' : 'none' }}>
                  <button onClick={() => setAberta(expandida ? null : chave)}
                    className="w-full flex items-start gap-3 px-3.5 py-3 text-left">
                    <span className="text-[17px] leading-none mt-0.5">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground leading-snug">{e.etapa}</p>
                      {e.produto && e.produto !== '—' && (
                        <p className="text-[11.5px] text-muted-foreground leading-snug">{e.produto}</p>
                      )}
                      {dose && dose !== '—' && (
                        <p className="text-[11.5px] font-semibold leading-snug" style={{ color: meta.color }}>
                          {dose}{tot ? ` · total no lote: ${tot}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10.5px] font-bold" style={{ color: cor }}>Dia {e.dia}</p>
                      {data && <p className="text-[10px] text-muted-foreground">{fmtBR(data).slice(0, 5)}</p>}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground mt-0.5 transition-transform flex-shrink-0"
                      style={{ transform: expandida ? 'rotate(90deg)' : 'none' }} />
                  </button>
                  <AnimatePresence initial={false}>
                    {expandida && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
                        <div className="px-3.5 pb-3 pl-11">
                          {e.forma && <p className="text-[11.5px] text-foreground/80 mb-1.5"><strong>Como:</strong> {e.forma}</p>}
                          {e.descricao && <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-2.5">{e.descricao}</p>}
                          {lote && (
                            <button onClick={() => levarAoAnotar(e, data)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white"
                              style={{ background: cor }}>
                              {data > hoje
                                ? <><CalendarClock size={14} /> Agendar para {fmtBR(data)}</>
                                : <><CheckCircle2 size={14} /> Já fiz (anotar)</>}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Chip({ on, cor, onClick, children }) {
  return (
    <button onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold border whitespace-nowrap"
      style={on ? { background: cor, borderColor: cor, color: '#fff' } : { background: '#fff', borderColor: 'hsl(140 13% 87%)', color: 'hsl(150 8% 35%)' }}>
      {children}
    </button>
  );
}

/** Resumo do plano de adubação calculado pela análise de solo do lote. */
function PlanoAduboCard({ plano, lote, cor }) {
  const [aberto, setAberto] = useState(true);
  const idx = plano.interpretacao?.indices || {};
  const fmt = (n, d = 1) => (n == null || !isFinite(n) ? '—' : n.toFixed(d).replace('.', ','));
  const a = lote.analise_solo || {};

  return (
    <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${cor}33` }}>
      <button onClick={() => setAberto(v => !v)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ background: `${cor}10` }}>
        <span className="text-[16px] leading-none">🧪</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-foreground leading-tight">Plano de adubação — sua análise de solo</p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {lote.tipo_solo ? `${lote.tipo_solo} · ` : ''}A adubação deste guia foi montada por esta análise
          </p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground transition-transform"
          style={{ transform: aberto ? 'rotate(90deg)' : 'none' }} />
      </button>

      {aberto && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['CTC', fmt(idx.ctc, 2)],
              ['V%', fmt(idx.v) + '%'],
              ['Sat. Al', fmt(idx.m) + '%'],
              ['Calagem', plano.precisaCalagem ? `${fmt(plano.calagem.adotada)} t/ha` : '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl py-1.5" style={{ background: `${cor}0c` }}>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{l}</p>
                <p className="text-[12px] font-bold text-foreground leading-tight mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {plano.diagnostico?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diagnóstico</p>
              {plano.diagnostico.map((d, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80 leading-snug">
                  <span style={{ color: cor }}>•</span><span>{d}</span>
                </div>
              ))}
            </div>
          )}

          {plano.resumo?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resumo de insumos</p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(140 13% 90%)' }}>
                {plano.resumo.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]"
                    style={{ background: i % 2 ? 'transparent' : 'hsl(140 14% 97%)' }}>
                    <span className="font-semibold text-foreground truncate">{r.produto}</span>
                    <span className="text-muted-foreground flex-shrink-0">{r.total}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${cor}14`, color: cor }}>{r.momento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer font-semibold">Ver valores da análise</summary>
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-1.5">
              {[
                ['pH', a.ph], ['P', a.p], ['K', a.k], ['Ca', a.ca], ['Mg', a.mg],
                ['Al', a.al], ['H+Al', a.hAl], ['MO', a.mo], ['Zn', a.zn], ['Argila%', a.argila],
              ].filter(([, v]) => v != null).map(([l, v]) => (
                <span key={l}>{l}: <strong className="text-foreground">{String(v).replace('.', ',')}</strong></span>
              ))}
            </div>
          </details>

          <p className="text-[10px] leading-snug" style={{ color: cor }}>
            ⚠️ Sequência crítica: <strong>calagem → (30+ dias) → fosfatagem/cova → plantio</strong>. Nunca calcário e superfosfato no mesmo dia.
          </p>
        </div>
      )}
    </div>
  );
}
