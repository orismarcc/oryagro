import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { exportPropriedadeBackup, importPropriedadeBackup } from '../lib/backupExport';
import { supabase } from '../lib/supabase';

// ─── Included items list ───────────────────────────────────────────────────────

const INCLUDED_ITEMS = [
  'Propriedade',
  'Lotes',
  'Eventos da linha do tempo',
  'Cronograma de atividades',
  'Diário de campo',
  'Vendas',
  'Estoque de insumos',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDateBR(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// ─── Export tab ───────────────────────────────────────────────────────────────

function ExportarTab({ propriedade }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null); // null | { success, error }

  const handleExport = async () => {
    setLoading(true);
    setResult(null);
    const res = await exportPropriedadeBackup(propriedade.id, propriedade.nome);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Description */}
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Faça o download de todos os dados desta propriedade (lotes, estoque, cronograma,
        eventos, diário e vendas) em um arquivo{' '}
        <span className="font-mono text-[12px] px-1 py-0.5 rounded" style={{ background: 'hsl(210 16% 93%)' }}>.oryagro</span>{' '}
        que pode ser restaurado posteriormente.
      </p>

      {/* Included items */}
      <div className="rounded-2xl p-4" style={{ background: 'hsl(160 50% 97%)', border: '1px solid hsl(160 40% 88%)' }}>
        <p className="text-[12px] font-bold mb-2.5" style={{ color: 'hsl(160 84% 24%)' }}>O backup inclui:</p>
        <ul className="space-y-1.5">
          {INCLUDED_ITEMS.map(item => (
            <li key={item} className="flex items-center gap-2 text-[12px]" style={{ color: 'hsl(160 84% 20%)' }}>
              <CheckCircle2 size={13} style={{ color: 'hsl(160 84% 32%)', flexShrink: 0 }} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Result feedback */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-xl px-4 py-3 flex items-start gap-2 text-[12px] font-medium"
            style={result.success
              ? { background: 'hsl(160 50% 94%)', color: 'hsl(160 84% 22%)', border: '1px solid hsl(160 40% 82%)' }
              : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }
            }
          >
            {result.success
              ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            {result.success
              ? 'Backup baixado com sucesso!'
              : `Erro ao exportar: ${result.error}`
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download button */}
      <button
        onClick={handleExport}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[14px] font-bold text-white disabled:opacity-60 transition-all active:scale-[0.98]"
        style={{ background: loading ? 'hsl(160 60% 36%)' : 'linear-gradient(135deg, hsl(160 84% 27%), hsl(150 72% 32%))' }}
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> Exportando…</>
          : <><Download size={16} /> Baixar Backup</>
        }
      </button>
    </div>
  );
}

// ─── Import tab ───────────────────────────────────────────────────────────────

function ImportarTab() {
  const [dragging,    setDragging]    = useState(false);
  const [file,        setFile]        = useState(null);   // File object
  const [parsed,      setParsed]      = useState(null);   // parsed JSON
  const [parseError,  setParseError]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState(null); // { success, error }
  const inputRef = useRef(null);

  const processFile = (f) => {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setParseError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.format !== 'oryagro-property-backup') {
          setParseError('Este arquivo não é um backup OryAgro válido.');
          return;
        }
        setParsed(data);
      } catch {
        setParseError('Não foi possível ler o arquivo. Certifique-se de que é um arquivo .oryagro válido.');
      }
    };
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setImportResult(null);

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const res = await importPropriedadeBackup(parsed, userId);
    setImportResult(res);
    setImporting(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Warning box */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-2"
        style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <AlertTriangle size={14} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
        <p className="text-[12px] leading-relaxed" style={{ color: '#9a3412' }}>
          Uma nova propriedade será criada com os dados do arquivo.
          Seus dados atuais <strong>não serão afetados</strong>.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="rounded-2xl flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? 'hsl(160 84% 35%)' : 'hsl(214 20% 80%)'}`,
          background: dragging ? 'hsl(160 50% 97%)' : 'hsl(210 16% 98%)',
        }}
      >
        <Upload size={22} style={{ color: dragging ? 'hsl(160 84% 35%)' : 'hsl(215 16% 55%)' }} />
        <p className="text-[13px] font-semibold" style={{ color: 'hsl(215 16% 40%)' }}>
          Clique ou arraste um arquivo aqui
        </p>
        <p className="text-[11px]" style={{ color: 'hsl(215 16% 60%)' }}>
          Aceita arquivos <span className="font-mono">.oryagro</span> ou <span className="font-mono">.json</span>
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".oryagro,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* File info + preview */}
      <AnimatePresence>
        {file && (
          <motion.div
            key="fileinfo"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">{fmtBytes(file.size)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null); setParsed(null); setParseError(null); setImportResult(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50">
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>

            {parseError && (
              <p className="text-[12px] font-medium" style={{ color: '#dc2626' }}>
                {parseError}
              </p>
            )}

            {parsed && (
              <div className="space-y-1">
                <p className="text-[12px] text-foreground">
                  <span className="font-semibold">Propriedade:</span>{' '}
                  {parsed.propriedade?.nome || '—'}
                </p>
                <p className="text-[12px] text-foreground">
                  <span className="font-semibold">Lotes:</span>{' '}
                  {(parsed.lotes || []).length}
                </p>
                <p className="text-[12px] text-foreground">
                  <span className="font-semibold">Exportado em:</span>{' '}
                  {fmtDateBR(parsed.exportedAt)}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import result */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            key="importResult"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl px-4 py-3 flex items-start gap-2 text-[12px] font-medium"
            style={importResult.success
              ? { background: 'hsl(160 50% 94%)', color: 'hsl(160 84% 22%)', border: '1px solid hsl(160 40% 82%)' }
              : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }
            }
          >
            {importResult.success
              ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            {importResult.success
              ? 'Propriedade importada com sucesso! Recarregue a página para vê-la na lista.'
              : importResult.error
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!parsed || importing}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[14px] font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, hsl(215 84% 40%), hsl(220 72% 48%))' }}
      >
        {importing
          ? <><Loader2 size={16} className="animate-spin" /> Importando…</>
          : <><Upload size={16} /> Importar Dados</>
        }
      </button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function BackupModal({ propriedade, onClose }) {
  const [activeTab, setActiveTab] = useState('exportar');

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center px-0 sm:px-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={handleBackdrop}
      >
        <motion.div
          key="card"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: '#fff', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0"
            style={{ borderBottom: '1px solid hsl(214 20% 92%)' }}>
            <div>
              <h2 className="font-display text-[17px] font-extrabold text-foreground leading-tight">
                Backup da Propriedade
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
                {propriedade?.nome}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-gray-100 text-muted-foreground ml-3 flex-shrink-0"
            >
              <X size={17} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5 pt-3 gap-1 flex-shrink-0">
            {['exportar', 'importar'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-xl text-[13px] font-bold capitalize transition-all"
                style={activeTab === tab
                  ? { background: 'hsl(160 84% 27%)', color: '#fff' }
                  : { background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }
                }
              >
                {tab === 'exportar' ? 'Exportar' : 'Importar'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AnimatePresence mode="wait">
              {activeTab === 'exportar' ? (
                <motion.div
                  key="exportar"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                >
                  <ExportarTab propriedade={propriedade} />
                </motion.div>
              ) : (
                <motion.div
                  key="importar"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <ImportarTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom safe-area spacer for mobile */}
          <div className="flex-shrink-0 h-4 sm:h-2" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
