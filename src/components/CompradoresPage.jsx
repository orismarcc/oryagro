import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  History,
} from 'lucide-react';
import {
  loadCompradores,
  upsertComprador,
  deleteComprador,
  loadParcelasByComprador,
  loadTodasParcelasPendentes,
  updateParcela,
} from '../hooks/useCompradores';

// ── Constante de segurança para padding acima da navbar ──────────────────────
const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';

// ── Helpers de formatação ────────────────────────────────────────────────────

function formatCPF(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCNPJ(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDocumento(raw, tipo) {
  if (!raw) return '';
  return tipo === 'cnpj' ? formatCNPJ(raw) : formatCPF(raw);
}

function formatTelefone(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function parseDateBR(iso) {
  if (!iso) return '';
  const [y, m, dia] = iso.split('T')[0].split('-');
  return `${dia}/${m}/${y}`;
}

function diffDays(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target - today) / 86_400_000);
}

function currencyBR(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const TIPO_LABEL = { varejo: 'Varejo', atacado: 'Atacado', pnae: 'PNAE', outros: 'Outros' };

const TIPO_COLORS = {
  varejo:  { bg: '#dbeafe', color: '#1d4ed8' },
  atacado: { bg: '#fef9c3', color: '#a16207' },
  pnae:    { bg: '#dcfce7', color: '#15803d' },
  outros:  { bg: '#f3e8ff', color: '#7e22ce' },
};

// ── Bottom Sheet wrapper ──────────────────────────────────────────────────────

function BottomSheet({ onClose, children, maxHeight = '92vh' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="rounded-t-3xl overflow-y-auto"
        style={{ background: 'white', maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(214 20% 88%)' }} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Modal: criar/editar comprador ────────────────────────────────────────────

function CompradorFormModal({ onClose, onSaved, existing = null }) {
  const isEdit = !!existing;

  const [tipoDoc,    setTipoDoc]    = useState(existing?.tipo_documento ?? 'cpf');
  const [docDisplay, setDocDisplay] = useState(
    existing?.documento ? formatDocumento(existing.documento, existing.tipo_documento) : ''
  );
  const [nome,      setNome]      = useState(existing?.nome ?? '');
  const [tipo,      setTipo]      = useState(existing?.tipo ?? 'varejo');
  const [telDisplay,setTelDisplay] = useState(
    existing?.telefone ? formatTelefone(existing.telefone) : ''
  );
  const [cidade,    setCidade]    = useState(existing?.cidade ?? '');
  const [status,    setStatus]    = useState(existing?.status ?? 'ativo');
  const [obs,       setObs]       = useState(existing?.observacao ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const handleDocChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setDocDisplay(tipoDoc === 'cnpj' ? formatCNPJ(digits) : formatCPF(digits));
  };

  const handleTipoDocToggle = (t) => {
    setTipoDoc(t);
    setDocDisplay('');
  };

  const handleTelChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setTelDisplay(formatTelefone(digits));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    setError('');
    const row = await upsertComprador({
      id: existing?.id,
      documento: docDisplay.replace(/\D/g, ''),
      tipoDocumento: tipoDoc,
      nome: nome.trim(),
      tipo,
      telefone: telDisplay.replace(/\D/g, ''),
      cidade: cidade.trim(),
      status,
      observacao: obs.trim(),
    });
    setSaving(false);
    if (!row) { setError('Erro ao salvar. Tente novamente.'); return; }
    onSaved(row);
    onClose();
  };

  const inputCls = 'w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none';
  const inputStyle = { background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' };
  const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground';

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-3 border-b flex items-center justify-between"
        style={{ borderColor: 'hsl(214 20% 91%)' }}>
        <h3 className="font-bold text-[15px]">
          {isEdit ? `Editar — ${existing.nome}` : 'Novo comprador'}
        </h3>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pt-4 space-y-3"
        style={{ paddingBottom: SAFE_BOTTOM }}>

        {/* Tipo de documento */}
        <div>
          <p className={labelCls}>Tipo de documento</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[{ k: 'cpf', l: 'CPF' }, { k: 'cnpj', l: 'CNPJ' }].map(({ k, l }) => (
              <button key={k} type="button"
                onClick={() => handleTipoDocToggle(k)}
                className="py-2 rounded-xl text-[12px] font-bold transition-all"
                style={tipoDoc === k
                  ? { background: 'hsl(160 84% 27%)', color: 'white' }
                  : { background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 45%)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Documento */}
        <div>
          <label className={labelCls}>
            {tipoDoc === 'cnpj' ? 'CNPJ' : 'CPF'}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={docDisplay}
            onChange={handleDocChange}
            placeholder={tipoDoc === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        {/* Nome */}
        <div>
          <label className={labelCls}>Nome completo *</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
            placeholder="Ex: João da Silva"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        {/* Tipo */}
        <div>
          <label className={labelCls}>Tipo</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="varejo">Varejo</option>
            <option value="atacado">Atacado</option>
            <option value="pnae">PNAE</option>
            <option value="outros">Outros</option>
          </select>
        </div>

        {/* Telefone + Cidade */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              type="text"
              inputMode="numeric"
              value={telDisplay}
              onChange={handleTelChange}
              placeholder="(00) 00000-0000"
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              type="text"
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              placeholder="Ex: Campinas"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <p className={labelCls}>Status</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[{ k: 'ativo', l: 'Ativo' }, { k: 'inativo', l: 'Inativo' }].map(({ k, l }) => (
              <button key={k} type="button"
                onClick={() => setStatus(k)}
                className="py-2 rounded-xl text-[12px] font-bold transition-all"
                style={status === k
                  ? k === 'ativo'
                    ? { background: '#dcfce7', color: '#15803d', border: '1.5px solid #86efac' }
                    : { background: 'hsl(210 16% 92%)', color: 'hsl(215 16% 35%)', border: '1.5px solid hsl(214 20% 80%)' }
                  : { background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 50%)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Observação */}
        <div>
          <label className={labelCls}>Observação — opcional</label>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={2}
            placeholder="Informações adicionais..."
            className={inputCls + ' resize-none'}
            style={inputStyle}
          />
        </div>

        {error && (
          <p className="text-[12px] font-semibold" style={{ color: '#dc2626' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !nome.trim()}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: 'hsl(160 84% 27%)' }}
        >
          {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar comprador'}
        </button>
      </form>
    </BottomSheet>
  );
}

// ── Mini-modal: marcar parcela como paga ─────────────────────────────────────

function PagarParcelaModal({ parcela, onClose, onPago }) {
  const [dataPagamento, setDataPagamento] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await updateParcela(parcela.id, { status: 'pago', dataPagamento });
    setSaving(false);
    onPago(parcela.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
        style={{ background: 'white' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-[14px]">Confirmar pagamento</h4>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-muted">
            <X size={13} />
          </button>
        </div>

        <p className="text-[12px] text-muted-foreground mb-1">
          Parcela {parcela.numero_parcela} · {currencyBR(parcela.valor)}
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Vencimento: {parseDateBR(parcela.data_vencimento)}
        </p>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Data do pagamento
          </label>
          <input
            type="date"
            value={dataPagamento}
            onChange={e => setDataPagamento(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2.5 text-[13px] outline-none"
            style={{ background: 'hsl(210 16% 96%)', borderColor: 'hsl(214 20% 88%)' }}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
            style={{ background: '#15803d' }}>
            {saving ? 'Salvando…' : 'Marcar como pago'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Histórico lateral ────────────────────────────────────────────────────────

function HistoricoPanel({ comprador, onClose }) {
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadParcelasByComprador(comprador.id)
      .then(setParcelas)
      .finally(() => setLoading(false));
  }, [comprador.id]);

  // Agrupa parcelas por venda_id
  const vendasMap = {};
  parcelas.forEach(p => {
    const key = p.venda_id;
    if (!vendasMap[key]) {
      vendasMap[key] = {
        venda_id: key,
        venda_data: p.venda_data,
        quantidade: p.quantidade,
        plantio_id: p.plantio_id,
        parcelas: [],
      };
    }
    vendasMap[key].parcelas.push(p);
  });
  const vendas = Object.values(vendasMap).sort((a, b) =>
    (b.venda_data || '').localeCompare(a.venda_data || '')
  );

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-sm shadow-xl overflow-y-auto"
      style={{ background: 'white' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 gradient-hero px-5 pt-6 pb-4">
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-3">
          <ChevronLeft size={16} />
          <span className="text-[12px] font-semibold">Fechar</span>
        </button>
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-0.5">Histórico</p>
        <h2 className="font-display text-white text-xl font-extrabold leading-tight truncate">
          {comprador.nome}
        </h2>
      </div>

      <div className="px-4 pt-4 space-y-4" style={{ paddingBottom: SAFE_BOTTOM }}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : vendas.length === 0 ? (
          <div className="text-center py-16">
            <History size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-[13px] text-muted-foreground">Nenhuma venda registrada.</p>
          </div>
        ) : (
          vendas.map(v => {
            const total = v.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
            const pagas = v.parcelas.filter(p => p.status === 'pago').length;
            const totalP = v.parcelas.length;
            const modoPagamento = totalP === 1 ? 'À vista' : `${pagas}/${totalP} parcelas pagas`;

            return (
              <div key={v.venda_id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-bold">{parseDateBR(v.venda_data)}</p>
                    {v.plantio_id && (
                      <p className="text-[11px] text-muted-foreground">Lote: {v.plantio_id}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Qtd: {v.quantidade}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-extrabold" style={{ color: 'hsl(160 84% 27%)' }}>
                      {currencyBR(total)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{modoPagamento}</p>
                  </div>
                </div>

                {totalP > 1 && (
                  <div className="space-y-1 pt-1 border-t" style={{ borderColor: 'hsl(214 20% 91%)' }}>
                    {v.parcelas.map(p => (
                      <div key={p.id}
                        className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Parcela {p.numero_parcela} · {parseDateBR(p.data_vencimento)}
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: p.status === 'pago' ? '#15803d' : '#d97706' }}>
                          {p.status === 'pago' ? 'Pago' : 'Pendente'} · {currencyBR(p.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ── Seção Cobranças Pendentes ─────────────────────────────────────────────────

function CobrancasPendentes() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagarModal, setPagarModal] = useState(null); // parcela | null

  const reload = useCallback(() => {
    setLoading(true);
    loadTodasParcelasPendentes()
      .then(setPendentes)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handlePago = (parcelaId) => {
    setPendentes(prev => prev.filter(p => p.id !== parcelaId));
  };

  // Agrupa por comprador
  const porComprador = {};
  pendentes.forEach(p => {
    const key = p.comprador_id || 'sem_comprador';
    if (!porComprador[key]) {
      porComprador[key] = {
        comprador_id: p.comprador_id,
        nome: p.comprador_nome || 'Sem comprador',
        parcelas: [],
      };
    }
    porComprador[key].parcelas.push(p);
  });
  const grupos = Object.values(porComprador);

  if (loading) {
    return (
      <div className="space-y-2 mt-2">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: '#15803d', opacity: 0.5 }} />
        <p className="text-[13px] text-muted-foreground">Nenhuma cobrança pendente.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 mt-2">
        {grupos.map(grupo => {
          const total = grupo.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
          return (
            <div key={grupo.comprador_id || 'sem'} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold">{grupo.nome}</p>
                <span className="text-[13px] font-extrabold" style={{ color: '#dc2626' }}>
                  {currencyBR(total)}
                </span>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {grupo.parcelas.map(p => {
                    const days = diffDays(p.data_vencimento);
                    const isVencida = days < 0;
                    const isProxima = days >= 0 && days <= 7;

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{
                          background: isVencida
                            ? '#fef2f2'
                            : isProxima
                            ? '#fefce8'
                            : 'hsl(210 16% 97%)',
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold">
                              Parcela {p.numero_parcela}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              · {parseDateBR(p.data_vencimento)}
                            </span>
                            {isVencida && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>
                                Vencida
                              </span>
                            )}
                            {isProxima && !isVencida && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fef9c3', color: '#a16207' }}>
                                Vence em {days === 0 ? 'hoje' : `${days}d`}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] font-bold mt-0.5"
                            style={{ color: isVencida ? '#dc2626' : '#374151' }}>
                            {currencyBR(p.valor)}
                          </p>
                        </div>

                        <button
                          onClick={() => setPagarModal(p)}
                          className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-white"
                          style={{ background: '#15803d' }}
                        >
                          Pago
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {pagarModal && (
          <PagarParcelaModal
            parcela={pagarModal}
            onClose={() => setPagarModal(null)}
            onPago={handlePago}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Chip de filtro ────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
      style={active
        ? { background: 'hsl(160 84% 27%)', color: 'white' }
        : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 40%)' }}
    >
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CompradoresPage({ onBack }) {
  const [compradores, setCompradores] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [busca, setBusca]             = useState('');
  const [filtro, setFiltro]           = useState('todos');
  const [formModal, setFormModal]     = useState(false);
  const [editModal, setEditModal]     = useState(null);   // comprador | null
  const [historicoFor, setHistoricoFor] = useState(null); // comprador | null

  const reload = useCallback(() => {
    loadCompradores().then(data => {
      setCompradores(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este comprador?')) return;
    const ok = await deleteComprador(id);
    if (ok) setCompradores(prev => prev.filter(c => c.id !== id));
  };

  const handleSaved = (row) => {
    setCompradores(prev => {
      const idx = prev.findIndex(c => c.id === row.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = row;
        return next;
      }
      return [...prev, row].sort((a, b) => a.nome.localeCompare(b.nome));
    });
  };

  const FILTROS = [
    { k: 'todos',   l: 'Todos'   },
    { k: 'ativo',   l: 'Ativo'   },
    { k: 'inativo', l: 'Inativo' },
    { k: 'varejo',  l: 'Varejo'  },
    { k: 'atacado', l: 'Atacado' },
    { k: 'pnae',    l: 'PNAE'    },
    { k: 'outros',  l: 'Outros'  },
  ];

  const filtrado = compradores.filter(c => {
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === 'todos') return true;
    if (filtro === 'ativo' || filtro === 'inativo') return c.status === filtro;
    return c.tipo === filtro;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero px-5 pt-6 pb-5">
        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-3">
            <ChevronLeft size={16} />
            <span className="text-[12px] font-semibold">Voltar</span>
          </button>
        )}
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">
          Vendas
        </p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">
          Compradores
        </h1>
        <p className="text-white/50 text-[11px] mt-1">
          {compradores.length} comprador{compradores.length !== 1 ? 'es' : ''} cadastrado{compradores.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="px-4 pt-4 pb-32 max-w-2xl mx-auto space-y-5">
        {/* Action bar */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Compradores cadastrados
          </p>
          <button
            onClick={() => setFormModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white"
            style={{ background: 'hsl(160 84% 27%)' }}
          >
            <Plus size={13} /> Novo comprador
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none pl-4"
            style={{
              background: 'white',
              borderColor: 'hsl(214 20% 88%)',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
            }}
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-muted">
              <X size={10} />
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4"
          style={{ scrollbarWidth: 'none' }}>
          {FILTROS.map(f => (
            <FilterChip
              key={f.k}
              label={f.l}
              active={filtro === f.k}
              onClick={() => setFiltro(f.k)}
            />
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-14">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-[13px] text-muted-foreground">Nenhum comprador encontrado.</p>
            {busca && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Tente limpar a busca.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtrado.map(c => {
                const tipoColors = TIPO_COLORS[c.tipo] || TIPO_COLORS.outros;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="card p-4"
                  >
                    {/* Linha 1: nome + badges */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-extrabold text-foreground leading-none">
                            {c.nome}
                          </p>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: tipoColors.bg, color: tipoColors.color }}
                          >
                            {TIPO_LABEL[c.tipo] || c.tipo}
                          </span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={c.status === 'ativo'
                              ? { background: '#dcfce7', color: '#15803d' }
                              : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 40%)' }}
                          >
                            {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        {/* Documento */}
                        {c.documento && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {c.tipo_documento?.toUpperCase() || 'Doc'}:{' '}
                            {formatDocumento(c.documento, c.tipo_documento)}
                          </p>
                        )}

                        {/* Telefone + Cidade */}
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.telefone && (
                            <p className="text-[11px] text-muted-foreground">
                              {formatTelefone(c.telefone)}
                            </p>
                          )}
                          {c.cidade && (
                            <p className="text-[11px] text-muted-foreground">
                              {c.cidade}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 pt-2 border-t"
                      style={{ borderColor: 'hsl(214 20% 93%)' }}>
                      <button
                        onClick={() => setEditModal(c)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                        style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}
                      >
                        <Pencil size={11} /> Editar
                      </button>
                      <button
                        onClick={() => setHistoricoFor(c)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        <History size={11} /> Ver histórico
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Cobranças pendentes */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={15} style={{ color: '#d97706' }} />
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#a16207' }}>
              Cobranças pendentes
            </p>
          </div>
          <CobrancasPendentes />
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {formModal && (
          <CompradorFormModal
            onClose={() => setFormModal(false)}
            onSaved={handleSaved}
          />
        )}
        {editModal && (
          <CompradorFormModal
            existing={editModal}
            onClose={() => setEditModal(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* Histórico lateral (slide from right, sem AnimatePresence overflow issue) */}
      <AnimatePresence>
        {historicoFor && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
              onClick={() => setHistoricoFor(null)}
            />
            <HistoricoPanel
              comprador={historicoFor}
              onClose={() => setHistoricoFor(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
