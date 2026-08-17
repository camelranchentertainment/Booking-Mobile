# RELAY TO CLAUDE CODE — Mobile App Phase 1: Expo Scaffold + Supabase Auth

**Context for Claude Code:** This is a new sub-project inside the existing `camelranchentertainment/Booking-Platform` monorepo (or a sibling repo — see Step 0 for the decision). It is the iOS/Android companion app for Camel Ranch Booking, built with React Native + Expo, connecting to the **same live Supabase project** (`ffnhrwfkiryohocscthu`) as the Next.js web app. Nothing about the web app's schema, RLS, or auth server-side config changes in this phase. This phase is: project scaffold, secure session storage, and auth (login/logout/session persistence) only. No calendar/roster/day-sheet screens yet — those are later phases.

**Before writing any code, verify these against the live Supabase project (do not trust cached assumptions):**
1. Confirm `profiles` is the canonical table (it is — `user_profiles` was dropped per prior session). Run `select column_name, data_type from information_schema.columns where table_name = 'profiles';` and confirm it has `id`, `act_id`, `role`, `display_name` at minimum.
2. Confirm auth is email/password via Supabase Auth (no separate custom auth system) by checking `auth.users` row count matches `profiles` row count roughly, and reviewing how `pages/_app.tsx` or `AuthContext.tsx` in the web repo currently calls `supabase.auth`.
3. Get the live Supabase project URL and anon key from Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — the mobile app uses the **anon key only**, never the service role key.

If any of the above doesn't match what's assumed in this document, stop and flag it before proceeding — don't silently adapt around a mismatch.

---

## Step 0: Repo decision

Recommend a **new sibling repo**: `camelranchentertainment/Booking-Mobile`. Reasons:
- Expo/RN has its own dependency tree, native build artifacts, and CI needs that don't belong mixed into the Next.js repo's `node_modules`/Vercel build pipeline.
- Vercel's build for the web app should never accidentally pick up React Native files.
- Independent versioning/release cadence (App Store/Play Store review cycles are unrelated to web deploys).

If Scott prefers a monorepo (e.g. for shared TypeScript types), use a `apps/mobile` + `apps/web` structure with a shared `packages/types` — but that's a bigger refactor of the existing repo and should be a separate, explicit decision, not bundled into this phase. **Default to the sibling repo unless told otherwise.**

---

## Step 1: Initialize the Expo project

```bash
npx create-expo-app@latest booking-mobile -t expo-template-blank-typescript
cd booking-mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install expo-secure-store
npm install @supabase/supabase-js
npm install --save-dev @types/react
```

Use **Expo Router** (file-based routing, the current Expo-recommended standard) rather than React Navigation configured by hand — it maps cleanly to the web app's page-based mental model (`/band`, `/settings`, etc.) and reduces boilerplate.

---

## Step 2: `app.json` — Expo config

```json
{
  "expo": {
    "name": "Camel Ranch Booking",
    "slug": "camel-ranch-booking",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "scheme": "camelranchbooking",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0E1628"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.camelranchentertainment.booking",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0E1628"
      },
      "package": "com.camelranchentertainment.booking"
    },
    "plugins": ["expo-router", "expo-secure-store"],
    "extra": {
      "eas": {
        "projectId": "REPLACE_AFTER_EAS_INIT"
      }
    }
  }
}
```

Note: `com.camelranchentertainment.booking` is a placeholder bundle ID / package name — confirm the exact reverse-DNS identifier Scott wants before running `eas build` for real, since this is very hard to change once submitted to either store.

---

## Step 3: Environment variables

```bash
# .env — NEVER commit this file. Add to .gitignore immediately.
EXPO_PUBLIC_SUPABASE_URL=https://ffnhrwfkiryohocscthu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon key — same one NEXT_PUBLIC_SUPABASE_ANON_KEY uses in Vercel, pull from there>
```

Expo requires the `EXPO_PUBLIC_` prefix for any env var to be inlined into the client bundle (this is the RN/Expo equivalent of Next.js's `NEXT_PUBLIC_` prefix — same security model: **anon key is safe to ship client-side because RLS enforces access control server-side, but it must still never be the service role key**).

```
# .gitignore additions
.env
.env.local
node_modules/
.expo/
dist/
```

---

## Step 4: Supabase client — secure, singleton, mobile-appropriate storage

This is the most important file in this phase. Three things it must get right, each mirroring a lesson already learned the hard way on the web app:

1. **Singleton guard** — same reasoning as `lib/supabase.ts` on web: prevent multiple `SupabaseClient` instances from Metro's module system re-evaluating, which caused token-reuse race conditions on web.
2. **Secure token storage** — RN has no `localStorage`. The naive approach (AsyncStorage, unencrypted) is the mobile equivalent of the "never store session tokens in localStorage" rule — AsyncStorage is unencrypted device storage. Use `expo-secure-store`, which is backed by iOS Keychain / Android Keystore.
3. **`getSession()` over `getUser()`** on app-load checks, per the same lesson learned on web (`getUser()` on every load caused session drops due to forcing a live network call instead of reading the cached/refreshed local session).

```typescript
// lib/supabase.ts
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
```

Peer dependency note: `react-native-url-polyfill` is required — Supabase JS depends on browser `URL`/`fetch` behavior that RN's JS engine (Hermes) doesn't fully provide without it.

```bash
npx expo install react-native-url-polyfill
```

---

## Step 5: Auth context (mirrors the web `AuthContext.tsx` contract, adapted for RN)

```typescript
// contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  act_id: string;
  role: 'superadmin' | 'band_admin' | 'member';
  display_name: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, act_id, role, display_name')
      .eq('id', userId)
      .single();

    if (profileError) {
      // A missing profiles row for an authenticated user is a real data
      // problem (see the orphaned-account issue already known on web) —
      // surface it distinctly rather than silently treating the user as
      // logged out, which would produce a confusing infinite redirect loop.
      console.error('Profile fetch failed for authenticated user:', profileError);
      setError(
        'Your account is authenticated but has no matching profile record. Contact support.'
      );
      return null;
    }
    return data as Profile;
  };

  useEffect(() => {
    let isMounted = true;

    // getSession() reads the persisted/cached session (SecureStore, via the
    // adapter above) without forcing a network round-trip — this is the
    // mobile equivalent of the getSession()-over-getUser() rule from the
    // web app's session-drop investigation. Do not change this to getUser()
    // for the initial load check.
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        const p = await fetchProfile(initialSession.user.id);
        if (isMounted) setProfile(p);
      }
      if (isMounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setError(null);
      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id);
        if (isMounted) setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      return { error: signInError.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        error,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

---

## Step 6: Route guard hook (mirrors `useRequireAuth.ts` on web)

```typescript
// hooks/useRequireAuth.ts
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Call once at the root layout. Redirects unauthenticated users to /login
 * and authenticated users away from /login, based on the current route
 * group. Mirrors the redirect contract of useRequireAuth.ts on the web app.
 */
export function useRequireAuth() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // don't redirect until initial session check resolves

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);
}
```

---

## Step 7: App shell / root layout (Expo Router)

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';

function RootLayoutNav() {
  useRequireAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor="#0E1628" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
```

```typescript
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
```

```typescript
// app/(app)/_layout.tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

---

## Step 8: Login screen — production-grade, accessible, brand-matched

```typescript
// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = {
  background: '#0E1628',
  accent: '#E8602A',
  text: '#F5EDD9',
  taglineBlue: '#6B8FB5',
  inputBackground: '#1A2540',
  errorRed: '#E85A5A',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting) return; // prevent double-submission

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError('Enter both email and password.');
      AccessibilityInfo.announceForAccessibility('Enter both email and password.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(trimmedEmail, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      AccessibilityInfo.announceForAccessibility(`Sign in failed: ${error}`);
    }
    // On success, onAuthStateChange in AuthContext updates session state,
    // and useRequireAuth in the root layout handles the redirect — no
    // manual navigation call needed here.
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Camel Ranch Booking
        </Text>
        <Text style={styles.tagline}>Sign in to your account</Text>

        <View style={styles.field}>
          <Text nativeID="emailLabel" style={styles.label}>
            Email
          </Text>
          <TextInput
            accessibilityLabelledBy="emailLabel"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor="#6B7A99"
            editable={!submitting}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text nativeID="passwordLabel" style={styles.label}>
            Password
          </Text>
          <TextInput
            accessibilityLabelledBy="passwordLabel"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor="#6B7A99"
            editable={!submitting}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {formError && (
          <Text style={styles.error} accessibilityLiveRegion="assertive">
            {formError}
          </Text>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [
            styles.button,
            submitting && styles.buttonDisabled,
            pressed && !submitting && styles.buttonPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    color: COLORS.taglineBlue,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48, // 48dp minimum touch target
    borderWidth: 1,
    borderColor: '#2A3655',
  },
  error: {
    color: COLORS.errorRed,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
```

---

## Step 9: Minimal authenticated home screen (placeholder for later phases)

```typescript
// app/(app)/index.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = {
  background: '#0E1628',
  accent: '#E8602A',
  text: '#F5EDD9',
  taglineBlue: '#6B8FB5',
};

export default function HomeScreen() {
  const { profile, loading, error, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}
      </Text>
      <Text style={styles.role}>Role: {profile?.role ?? 'unknown'}</Text>
      <Text style={styles.subtitle}>
        Calendar, day sheets, and roster land in the next phases.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={signOut}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  role: {
    color: COLORS.taglineBlue,
    fontSize: 14,
    marginBottom: 20,
  },
  subtitle: {
    color: '#8A96B5',
    fontSize: 14,
    marginBottom: 32,
  },
  errorText: {
    color: '#E85A5A',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
```

---

## Step 10: `tsconfig.json` — strict mode, no exceptions

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

---

## Step 11: Verification checklist (run in Codespace, confirm each before moving on)

1. `npx expo start` boots without red-screen errors.
2. Login screen renders with correct brand colors (`#0E1628` background, `#E8602A` button).
3. Sign in with an existing test account (e.g. the external test user `grueneroadcases@gmail.com` if credentials are available, or a throwaway test account created in Supabase Auth directly — **do not test with Scott's own superadmin account given the known orphaned-`user_profiles`-row issue on that account; confirm the `profiles` row exists for whichever account you test with first**).
4. After successful login, confirm redirect to `(app)/index.tsx` and that `profile.role` and `profile.display_name` render correctly — this confirms the `profiles` table read is scoped correctly and RLS allows the authenticated user to read their own row.
5. Force-quit the app (not just backgrounding) and relaunch — confirm the session persists (no re-prompt for login), proving the `expo-secure-store` adapter round-trips correctly.
6. Tap Sign Out — confirm redirect back to `/login` and that relaunching the app does NOT restore the session.
7. Run `npx tsc --noEmit` — zero errors expected (no `TS5103`-equivalent masking issue exists in a fresh RN project, unlike the known Codespaces issue on the web repo, so treat any error here as real).

Report back per-step pass/fail — do not report this phase as "done" without having actually run steps 3–6 against the live Supabase project, per the standing verification discipline (never trust "done" without independent verification against live state).

---

## Explicitly deferred to later phases (do not build now)

- Calendar view / Google Calendar sync read
- Day sheets
- Roster
- Push notifications (Expo push token registration, storage in Supabase, trigger wiring)
- EAS Build configuration and first TestFlight/Internal Testing submission
- App icon / splash asset finalization (placeholder colors only for now)
