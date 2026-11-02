import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Call once at the root layout. Redirects unauthenticated users to /login
 * and authenticated users away from /login, based on the current route
 * group. Mirrors the redirect contract of useRequireAuth.ts on the web app.
 */
export function useRequireAuth() {
  const { session, loading, agentWorkspace } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // don't redirect until initial session check resolves

    const inAuthGroup = segments[0] === '(auth)';
    const inAgentGroup = segments[0] === '(agent)';
    const isAgent = agentWorkspace !== null;

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace(isAgent ? '/(agent)' : '/(app)');
    } else if (session && isAgent && !inAgentGroup) {
      // Each login belongs to one side: an agent never sees the band screens.
      router.replace('/(agent)');
    } else if (session && !isAgent && inAgentGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments, agentWorkspace]);
}
