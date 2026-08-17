import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Check .env and confirm expo-constants picked it up (restart the dev server after editing .env).'
  );
}

/**
 * expo-secure-store has a hard 2048-byte-per-value limit on some platforms.
 * Supabase session objects (access token + refresh token + user metadata)
 * can exceed this. This adapter chunks large values across multiple
 * SecureStore keys transparently. This is not optional — without it,
 * session persistence silently fails once the JWT payload grows
 * (e.g. as more claims/metadata get added to the user object over time).
 */
const CHUNK_SIZE = 1800; // stay under the 2048 byte limit with margin

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountRaw) {
      // Fall back to a plain single-key read for values written before
      // chunking existed, or values that never needed chunking.
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = await SecureStore.getItemAsync(`${key}_${i}`);
      if (part === null) {
        // A chunk went missing — treat the whole value as corrupted/absent
        // rather than returning a truncated session that will fail auth
        // in a confusing way downstream.
        return null;
      }
      parts.push(part);
    }
    return parts.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      return;
    }
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_${i}`, chunk);
    }
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
    // Also clear a stale unchunked value from a previous session shape.
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
  removeItem: async (key: string): Promise<void> => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

// Singleton guard — mirrors lib/supabase.ts on the web app. Metro's fast
// refresh / module re-evaluation during development can otherwise create
// multiple SupabaseClient instances, each with its own auto-refresh timer,
// which is exactly the token-reuse race condition already diagnosed and
// fixed on the web platform.
declare global {
  // eslint-disable-next-line no-var
  var __camelRanchSupabaseClient: SupabaseClient | undefined;
}

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // no browser URL to parse on native
    },
  });
}

export const supabase: SupabaseClient =
  global.__camelRanchSupabaseClient ?? createSupabaseClient();

if (process.env.NODE_ENV !== 'production') {
  global.__camelRanchSupabaseClient = supabase;
}
