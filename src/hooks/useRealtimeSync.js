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
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @param {string}             table      - Supabase table name
 * @param {function}           onRefresh  - Callback to run when a remote change arrives
 * @param {{ column: string, value: string } | null} [filter] - Optional server-side filter
 */
export function useRealtimeSync(table, onRefresh, filter = null) {
  // Keep callback in a ref so we don't re-subscribe on every render
  const refreshRef = useRef(onRefresh);
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  const filterValue = filter?.value ?? null;

  useEffect(() => {
    if (!table) return;

    // Unique channel name: scoped to table + optional filter value
    const channelName = filter?.value
      ? `rt_${table}_${filter.column}_${filter.value}`
      : `rt_${table}`;

    const pgConfig = {
      event:  '*',
      schema: 'public',
      table,
      ...(filter?.column && filter?.value
        ? { filter: `${filter.column}=eq.${filter.value}` }
        : {}),
    };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', pgConfig, () => {
        refreshRef.current?.();
      })
      .subscribe((status) => {
        // CLOSED / CHANNEL_ERROR → silent; component will still work via manual fetches
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[useRealtimeSync] channel error on table "${table}"`);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [table, filterValue]); // eslint-disable-line react-hooks/exhaustive-deps
}
