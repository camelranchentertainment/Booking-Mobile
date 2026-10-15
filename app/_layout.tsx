import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Shrikhand_400Regular } from '@expo-google-fonts/shrikhand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { colors } from '../lib/theme';

// Keep the native splash up until the retro fonts are ready, so nobody
// ever sees a frame of system-font fallback text.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden (e.g. fast refresh) — safe to ignore */
});

function RootLayoutNav() {
  useRequireAuth();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Shrikhand_400Regular,
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) {
      // Non-fatal: the app still works with system fonts.
      console.warn('[fonts] failed to load brand fonts, falling back to system fonts', fontError);
    }
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
