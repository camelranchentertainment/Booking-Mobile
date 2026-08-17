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
