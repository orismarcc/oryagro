import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CULTURAS } from '../data/culturas';
import { loadCronogramaAtividades } from '../hooks/useSupabaseSync';
import { makeStableId } from '../hooks/useCronogramaSync';

// ─── constants ────────────────────────────────────────────────────────────────
const GREEN = 'hsl(160 84% 27%)';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(a, b) {
  // how many full days is `a` ahead of `b` (both normalised to midnight)
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// ─── sub-components ───────────────────────────────────────────────────────────
function DayBadge({ dias }) {
  let label, bg, color;
  if (dias < 0) {
    label = `Vencida`;
    bg = '#fee2e2';
    color = '#991b1b';
  } else if (dias === 0) {
    label = 'Hoje';
    bg = '#fee2e2';
    color = '#991b1b';
  } else if (dias === 1) {
    label = 'Amanhã';
    bg = '#ffedd5';
    color = '#9a3412';
  } else {
    label = `Em ${dias} dias`;
    bg = '#fef9c3';
    color = '#854d0e';
  }
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function NotificacoesBell({
  lotes = [],
  propriedades = [],
  onNavigateToLote,
  onNavigateToCompradores,
}) {
  const [open, setOpen] = useState(false);
  const [etapasVencendo, setEtapasVencendo] = useState([]);
  const [cobrancasVencendo, setCobrancasVencendo] = useState([]);
  const [loadingCobr, setLoadingCobr] = useState(false);

  // ── calcular etapas (fonte principal: Supabase; fallback: localStorage) ──────
  useEffect(() => {
    if (!lotes.length) return;

    const hoje = startOfDay(new Date());
    const lotesAtivos = lotes.filter(l => l.status === 'ativo');

    async function calcularEtapas() {
      const resultado = [];

      await Promise.all(lotesAtivos.map(async (lote) => {
        const cultura = CULTURAS[lote.cultura_id];
        if (!cultura?.cronograma) return;

        let concluidas = new Set();
        let removidas  = new Set();

        // 1. Carrega do Supabase (fonte de verdade)
        try {
          const dbRows = await loadCronogramaAtividades(lote.id);
          dbRows.forEach(row => {
            const _id = makeStableId('default', row.etapa);
            if (row.status === 'feito')    concluidas.add(_id);
            if (row.status === 'removida') removidas.add(_id);
          });
        } catch (_) { /* continua com sets vazios, complementado pelo localStorage */ }

        // 2. Sempre mescla localStorage — captura deleções feitas antes do fix de sync
        //    (status 'removida' que nunca chegou ao Supabase)
        const statusKey = `cronograma_status_lote_${lote.id}`;
        try {
          const statusLocal = JSON.parse(localStorage.getItem(statusKey) || '{}');
          Object.entries(statusLocal).forEach(([id, val]) => {
            if (val?.status === 'feito')    concluidas.add(id);
            if (val?.status === 'removida') removidas.add(id);
          });
        } catch (_) {}

        const dataBase = new Date(lote.data_plantio + 'T12:00:00');

        // Aplica a mesma escala de dias que o CronogramaTimeline usa
        // para que as datas de notificação batam com o cronograma exibido
        const metodoObj = (lote.metodo_propagacao && cultura.metodosPropagacao)
          ? (cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null)
          : null;
        const diasViveiroAtual = metodoObj ? (metodoObj.diasViveiro || 0) : 0;
        const diasPrimeiraProducaoAtual = metodoObj?.lifecycle?.diasPrimeiraProducao ?? null;
        const maxBaseDia = cultura.cronograma.length > 0
          ? Math.max(...cultura.cronograma.map(e => e.dia))
          : 0;
        const scaleBaseDia = (originalDia) => {
          if (!diasPrimeiraProducaoAtual || maxBaseDia === 0) return originalDia + diasViveiroAtual;
          return Math.round(
            diasViveiroAtual + (originalDia / maxBaseDia) * (diasPrimeiraProducaoAtual - diasViveiroAtual)
          );
        };

        for (const etapa of cultura.cronograma) {
          const _id = makeStableId('default', etapa.etapa);
          if (concluidas.has(_id) || removidas.has(_id)) continue;

          const diaEscalado = scaleBaseDia(etapa.dia);
          const dataEtapa = addDays(dataBase, diaEscalado);
          const diasRestantes = diffDays(dataEtapa, hoje);

          if (diasRestantes >= 0 && diasRestantes <= 7) {
            resultado.push({ lote, etapa: { ...etapa, dia: diaEscalado }, dataEtapa, diasRestantes });
          }
        }
      }));

      resultado.sort((a, b) => a.dataEtapa - b.dataEtapa);
      setEtapasVencendo(resultado);
    }

    calcularEtapas();
  }, [lotes]);

  // ── buscar cobranças ─────────────────────────────────────────────────────
  const fetchCobranças = useCallback(async () => {
    setLoadingCobr(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingCobr(false); return; }

      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      // query principal
      const { data: parcelas, error } = await supabase
        .from('venda_parcelas')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pendente')
        .lte('data_vencimento', em7dias)
        .order('data_vencimento', { ascending: true });

      if (error || !parcelas) { setLoadingCobr(false); return; }

      // buscar nomes dos compradores via vendas
      const vendaIds = [...new Set(parcelas.map(p => p.venda_id).filter(Boolean))];
      let vendaMap = {};

      if (vendaIds.length > 0) {
        const { data: vendas } = await supabase
          .from('vendas')
          .select('id, comprador_id')
          .in('id', vendaIds);

        if (vendas) {
          const compradorIds = [...new Set(vendas.map(v => v.comprador_id).filter(Boolean))];
          let compradorMap = {};

          if (compradorIds.length > 0) {
            const { data: compradores } = await supabase
              .from('compradores')
              .select('id, nome')
              .in('id', compradorIds);
            if (compradores) {
              compradores.forEach(c => { compradorMap[c.id] = c.nome; });
            }
          }

          vendas.forEach(v => {
            vendaMap[v.id] = compradorMap[v.comprador_id] || null;
          });
        }
      }

      // montar lista final com nome do comprador
      const hoje = new Date().toISOString().slice(0, 10);
      const lista = parcelas.map((p, idx) => {
        const nomeComprador = vendaMap[p.venda_id] || null;
        const dias = diffDays(new Date(p.data_vencimento + 'T12:00:00'), startOfDay(new Date()));
        return { ...p, nomeComprador, diasRestantes: dias };
      });

      setCobrancasVencendo(lista);
    } catch (_) {
      // silently fail
    } finally {
      setLoadingCobr(false);
    }
  }, []);

  // busca cobranças no mount e sempre que o painel abre
  useEffect(() => { fetchCobranças(); }, [fetchCobranças]);
  useEffect(() => { if (open) fetchCobranças(); }, [open, fetchCobranças]);

  const count = etapasVencendo.length + cobrancasVencendo.length;

  const handleClose = () => setOpen(false);

  const handleEtapaClick = (lote) => {
    onNavigateToLote?.(lote.id, lote.propriedade_id);
    handleClose();
  };

  const handleCobrancaClick = () => {
    onNavigateToCompradores?.();
    handleClose();
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger (sino) — imediatamente à esquerda do HamburgerMenu ── */}
      {/* Hamburger: right:12px, width:40px → left edge at right:52px         */}
      {/* Bell: right:60px (52px + 4px gap + 4px extra) → gap de 4px         */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen(prev => !prev)}
        className="fixed z-50 flex items-center justify-center w-10 h-10 rounded-2xl shadow-md"
        style={{
          top: 'calc(var(--safe-top) + 8px)',
          right: '60px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid hsl(214 20% 88%)',
          boxShadow: '0 4px 14px -2px rgb(0 0 0 / 0.12)',
        }}
        aria-label="Notificações"
      >
        <div className="relative">
          <Bell size={18} style={{ color: GREEN }} />
          {count > 0 && (
            <span
              className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none"
              style={{ background: '#dc2626' }}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* ── Backdrop ── */}
            <motion.div
              key="notif-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={handleClose}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.25)' }}
            />

            {/* ── Painel dropdown ── */}
            <motion.div
              key="notif-panel"
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed z-50 max-h-[70vh] flex flex-col rounded-2xl shadow-xl overflow-hidden"
              style={{
                top: 'calc(var(--safe-top) + 58px)',
                right: '12px',
                // Largura responsiva: máx 320px, mas nunca estoura telas pequenas
                // (iPhone SE 320px). Antes era w-80 fixo → overflow em <344px.
                width: 'min(20rem, calc(100vw - 24px))',
                background: '#ffffff',
                border: '1px solid hsl(214 20% 90%)',
                boxShadow: '0 8px 40px -4px rgb(0 0 0 / 0.18)',
              }}
            >
              {/* Header do painel */}
              <div
                className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid hsl(214 20% 92%)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold" style={{ color: 'hsl(215 16% 18%)' }}>
                    Notificações
                  </span>
                  {count > 0 && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: '#dc2626' }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleClose}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ color: 'hsl(215 16% 50%)' }}
                  aria-label="Fechar notificações"
                >
                  <X size={15} />
                </motion.button>
              </div>

              {/* Corpo com scroll */}
              <div className="overflow-y-auto flex-1">

                {/* ── Seção 1: Etapas do Cronograma ── */}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(215 16% 55%)' }}>
                    Etapas do Cronograma · próx. 7 dias
                  </p>

                  {etapasVencendo.length === 0 ? (
                    <p className="text-[13px] py-2 pb-3" style={{ color: 'hsl(215 16% 50%)' }}>
                      Nenhuma etapa vencendo nos próximos 7 dias
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 pb-2">
                      {etapasVencendo.map(({ lote, etapa, diasRestantes }, idx) => {
                        const cultura = CULTURAS[lote.cultura_id];
                        const emoji = cultura?.emoji ?? '🌱';
                        return (
                          <motion.button
                            key={`etapa-${lote.id}-${etapa.etapa}-${idx}`}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleEtapaClick(lote)}
                            className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                            style={{
                              background: 'hsl(152 40% 97%)',
                              border: '1px solid hsl(152 40% 88%)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'hsl(152 40% 93%)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'hsl(152 40% 97%)'}
                          >
                            <span className="text-base leading-none mt-0.5 flex-shrink-0">{emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-[12px] font-semibold truncate"
                                style={{ color: 'hsl(215 16% 22%)' }}
                              >
                                {lote.nome ?? `Lote #${lote.id}`}
                              </p>
                              <p
                                className="text-[11px] truncate"
                                style={{ color: 'hsl(215 16% 45%)' }}
                              >
                                {etapa.etapa}
                              </p>
                            </div>
                            <DayBadge dias={diasRestantes} />
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Separador */}
                <div className="mx-4 my-1" style={{ height: 1, background: 'hsl(214 20% 92%)' }} />

                {/* ── Seção 2: Cobranças vencendo ── */}
                <div className="px-4 pt-2 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(215 16% 55%)' }}>
                    Cobranças vencendo
                  </p>

                  {loadingCobr ? (
                    <p className="text-[13px] py-2" style={{ color: 'hsl(215 16% 60%)' }}>
                      Carregando...
                    </p>
                  ) : cobrancasVencendo.length === 0 ? (
                    <p className="text-[13px] py-2" style={{ color: 'hsl(215 16% 50%)' }}>
                      Nenhuma cobrança vencendo
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {cobrancasVencendo.map((parcela, idx) => (
                        <motion.button
                          key={`cobr-${parcela.id ?? idx}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCobrancaClick}
                          className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                          style={{
                            background: 'hsl(30 100% 97%)',
                            border: '1px solid hsl(30 100% 88%)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'hsl(30 100% 93%)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'hsl(30 100% 97%)'}
                        >
                          <span className="text-base leading-none mt-0.5 flex-shrink-0">💰</span>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[12px] font-semibold truncate"
                              style={{ color: 'hsl(215 16% 22%)' }}
                            >
                              Parcela {parcela.numero ?? idx + 1}
                              {parcela.nomeComprador ? ` — ${parcela.nomeComprador}` : parcela.venda_id ? ` — Venda` : ''}
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: 'hsl(215 16% 45%)' }}
                            >
                              {formatBRL(parcela.valor)} · vence {formatDate(parcela.data_vencimento)}
                            </p>
                          </div>
                          <DayBadge dias={parcela.diasRestantes} />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
