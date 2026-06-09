/**
 * useRealtimeSync.js
 *
 * Generic Supabase Realtime hook for postgres_changes.
 * Any INSERT / UPDATE / DELETE in the watched table calls `onRefresh`,
 * making the UI reflect remote changes (other users / other devices)
 * within ~1 second without polling.
 *
 * Usage:
 *   useRealtimeSync('despesas', fetchRegistros)
 *   useRealtimeSync('vendas',   fetchVendas,  { column: 'plantio_id', value: lote.id })
 *
 * Notes:
 *   - `onRefresh` is stored in a ref so changing it never causes re-subscription.
 *   - Re-subscribes only when `table` or `filter.value` changes.
 *   - RLS ensures the user only receives rows they're allowed to see.
 *   - Channel names include the filter value so each open tab/component
 *     gets an isolated subscription.
 *   - CHANNEL_ERROR/TIMED_OUT → retry automático com backoff exponencial
 *     (2s → 4s → 8s → 16s → 30s máx). Essencial para rede fraca no campo:
 *     sem isso o sync multi-device morria silenciosamente até refresh manual.
 *     Ao reconectar com sucesso, dispara onRefresh() para buscar o que foi
 *     perdido durante a janela offline.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS  = 30000;

/**
 * @param {string}             table      - Supabase table name
 * @param {function}           onRefresh  - Callback to run when a remote change arrives
 * @param {{ column: string, value: string } | null} [filter] - Optional server-side filter
 */
export function useRealtimeSync(table, onRefresh, filter = null) {
  // Keep callback in a ref so we don't re-subscribe on every render
  const refreshRef = useRef(onRefresh);
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  // Stable per-instance ID so unfiltered channels never collide across components
  const instanceId = useRef(`${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);

  const filterValue = filter?.value ?? null;

  useEffect(() => {
    if (!table) return;

    let channel = null;
    let retryTimer = null;
    let attempt = 0;
    let disposed = false;
    let everConnected = false;

    const channelName = filter?.value
      ? `rt_${table}_${filter.column}_${filter.value}`
      : `rt_${table}_${instanceId.current}`;

    const pgConfig = {
      event:  '*',
      schema: 'public',
      table,
      ...(filter?.column && filter?.value
        ? { filter: `${filter.column}=eq.${filter.value}` }
        : {}),
    };

    const connect = () => {
      if (disposed) return;
      // Remove canal anterior antes de recriar (evita vazamento de sockets)
      if (channel) { supabase.removeChannel(channel); channel = null; }

      channel = supabase
        .channel(`${channelName}_a${attempt}`)
        .on('postgres_changes', pgConfig, () => {
          refreshRef.current?.();
        })
        .subscribe((status) => {
          if (disposed) return;

          if (status === 'SUBSCRIBED') {
            // Reconexão após falha → busca mudanças perdidas na janela offline
            if (everConnected && attempt > 0) refreshRef.current?.();
            everConnected = true;
            attempt = 0;
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            attempt += 1;
            const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
            console.warn(
              `[useRealtimeSync] ${status} on "${table}" — retry #${attempt} em ${delay / 1000}s`,
            );
            clearTimeout(retryTimer);
            retryTimer = setTimeout(connect, delay);
          }
          // CLOSED durante cleanup é esperado — sem ação.
        });
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filterValue]); // eslint-disable-line react-hooks/exhaustive-deps
}
