import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { pendingCount } from '../lib/outbox';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const [pendentes, setPendentes] = useState(() => pendingCount());

  useEffect(() => {
    let reconnectTimer;
    const handleOnline  = () => {
      setIsOnline(true);
      setJustReconnected(true);
      reconnectTimer = setTimeout(() => setJustReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      clearTimeout(reconnectTimer);
    };
    const handleOutbox = (e) => setPendentes(e.detail?.size ?? pendingCount());
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('oryagro:outbox-change', handleOutbox);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('oryagro:outbox-change', handleOutbox);
      clearTimeout(reconnectTimer);
    };
  }, []);

  const showOffline       = !isOnline;
  const showReconnected   = isOnline && justReconnected;

  return (
    <AnimatePresence>
      {showOffline && (
        <motion.div
          key="offline"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-amber-900"
          style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a' }}
        >
          <WifiOff size={14} />
          {pendentes > 0
            ? `Sem conexão – ${pendentes} alteração${pendentes > 1 ? 'ões' : ''} salva${pendentes > 1 ? 's' : ''} na fila para sincronizar.`
            : 'Sem conexão – modo offline. Algumas funções podem não funcionar.'}
        </motion.div>
      )}
      {showReconnected && (
        <motion.div
          key="reconnected"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-emerald-900"
          style={{ background: '#d1fae5', borderBottom: '1px solid #a7f3d0' }}
        >
          <Wifi size={14} />
          Conexão restaurada!
        </motion.div>
      )}
    </AnimatePresence>
  );
}
