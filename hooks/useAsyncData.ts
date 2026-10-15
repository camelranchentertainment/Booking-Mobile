import { useCallback, useEffect, useEffectEvent, useState } from 'react';

interface Snapshot<T> {
  key: string;
  data: T | null;
  error: string | null;
}

export interface AsyncData<T> {
  /** Data for the *current* key, or null while it loads / after an error. */
  data: T | null;
  error: string | null;
  loading: boolean;
  /** True only during a user-initiated pull-to-refresh. */
  refreshing: boolean;
  /** Re-runs the fetch (pull-to-refresh, "Try again"). Resolves when it settles. */
  refresh: () => Promise<void>;
}

/**
 * Loads data for a key and keeps it in sync when the key changes.
 *
 * - Results are tagged with the key they were fetched for, so switching
 *   keys (e.g. paging calendar months) shows a loading state instead of
 *   the previous key's data, and a slow response for an old key can never
 *   overwrite a newer one.
 * - State is only set from promise callbacks, never synchronously inside
 *   the effect body (React Compiler's set-state-in-effect rule).
 * - Raw errors are logged for debugging; the UI gets `errorMessage`.
 *
 * @param key     Identity of the request; changing it triggers a new fetch.
 * @param fetcher Performs the request. May close over current props/state.
 * @param errorMessage Human-friendly message shown when the fetch fails.
 */
export function useAsyncData<T>(key: string, fetcher: () => Promise<T>, errorMessage: string): AsyncData<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const run = useEffectEvent(async (forKey: string): Promise<Snapshot<T>> => {
    try {
      return { key: forKey, data: await fetcher(), error: null };
    } catch (err) {
      console.error(`[useAsyncData] fetch failed for "${forKey}"`, err);
      return { key: forKey, data: null, error: errorMessage };
    }
  });

  useEffect(() => {
    let active = true;
    run(key).then((next) => {
      if (active) setSnapshot(next);
    });
    return () => {
      active = false;
    };
  }, [key]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let next: Snapshot<T>;
      try {
        next = { key, data: await fetcher(), error: null };
      } catch (err) {
        console.error(`[useAsyncData] refresh failed for "${key}"`, err);
        next = { key, data: null, error: errorMessage };
      }
      setSnapshot(next);
    } finally {
      setRefreshing(false);
    }
  }, [key, fetcher, errorMessage]);

  const current = snapshot?.key === key ? snapshot : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    refreshing,
    refresh,
  };
}
