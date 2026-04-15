import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Failed to fetch profile:', error.message);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('Profile fetch exception:', err);
    }
  }, []);

  useEffect(() => {
    let settled = false;

    const AUTH_TIMEOUT_MS = 5000;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setIsLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (settled) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await fetchProfile(s.user.id);
      settled = true;
      clearTimeout(timeout);
      setIsLoading(false);
    }).catch(() => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
        }
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Force clear even if signOut API fails
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isAdmin: profile?.is_admin ?? false,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
