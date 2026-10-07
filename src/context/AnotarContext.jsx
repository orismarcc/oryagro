/**
 * AnotarContext — abre o "Anotar" de qualquer tela, com uma única instância.
 *
 *   const { anotar, versao } = useAnotar();
 *   anotar();                       // escolhe os lotes na hora
 *   anotar({ loteId });             // já com o lote marcado
 *   anotar({ editar: atividade });  // edita um registro
 *   anotar({ agendado: true });     // já no modo Agendar
 *   anotar({ data: '2026-10-10' }); // já com a data escolhida (Agenda)
 *
 * `versao` muda a cada gravação: listas que dependem dos registros usam como
 * dependência para recarregar sozinhas (Início, lote, agenda).
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import AnotarSheet from '../components/AnotarSheet';

const AnotarCtx = createContext({ anotar: () => {}, versao: 0, avisarMudanca: () => {} });

export function AnotarProvider({ lotes = [], onAbrir, children }) {
  const [estado, setEstado] = useState({ open: false, loteId: null, editar: null, agendado: false, data: null, n: 0 });
  const [versao, setVersao] = useState(0);

  const anotar = useCallback((opts = {}) => {
    onAbrir?.();
    setEstado(s => ({ open: true, loteId: opts.loteId ?? null, editar: opts.editar ?? null, agendado: !!opts.agendado, data: opts.data ?? null, n: s.n + 1 }));
  }, [onAbrir]);

  const avisarMudanca = useCallback(() => setVersao(v => v + 1), []);

  return (
    <AnotarCtx.Provider value={{ anotar, versao, avisarMudanca }}>
      {children}
      <AnotarSheet
        open={estado.open}
        lotes={lotes}
        loteInicialId={estado.loteId}
        editar={estado.editar}
        agendadoInicial={estado.agendado}
        dataInicial={estado.data}
        aberturaId={estado.n}
        onClose={() => setEstado(s => ({ ...s, open: false }))}
        onSaved={avisarMudanca}
      />
    </AnotarCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAnotar = () => useContext(AnotarCtx);
