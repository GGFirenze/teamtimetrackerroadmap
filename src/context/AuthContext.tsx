import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase, restQuery, getAccessToken } from '../lib/supabase';
import { identifyUser, resetUser, trackSignInCompleted } from '../analytics';
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
  accessToken: string | null;
  googleToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function fetchProfileViaRest(
  userId: string,
  token: string | null
): Promise<Profile | null> {
  try {
    const rows = await restQuery<Profile[]>(
      `profiles?id=eq.${userId}&select=*&limit=1`,
      { token }
    );
    return rows?.[0] ?? null;
  } catch (err) {
    console.error('Profile fetch failed:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const GOOGLE_TOKEN_KEY = 'ps-tracker-google-token';

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(
    () => localStorage.getItem(GOOGLE_TOKEN_KEY)
  );

  useEffect(() => {
    let settled = false;

    const AUTH_TIMEOUT_MS = 8000;
    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn('Auth init timed out');
        settled = true;
        setIsLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    const settle = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
      }
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        console.info('Auth event:', event);

        if (event === 'SIGNED_IN' && s) {
          if (s.provider_token) {
            localStorage.setItem(GOOGLE_TOKEN_KEY, s.provider_token);
            setGoogleToken(s.provider_token);
          }
          const params = new URLSearchParams(window.location.search);
          if (params.has('code')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const token = s.access_token || getAccessToken();
          const p = await fetchProfileViaRest(s.user.id, token);
          setProfile(p);
          if (p) {
            identifyUser(p.id, p.email, p.full_name);
          }
          if (event === 'SIGNED_IN') {
            trackSignInCompleted();
          }
        } else {
          setProfile(null);
        }
        settle();
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (settled) return;
      if (!s) {
        settle();
        return;
      }
      setSession(s);
      setUser(s.user);
      const p = await fetchProfileViaRest(s.user.id, s.access_token);
      setProfile(p);
      if (p) {
        identifyUser(p.id, p.email, p.full_name);
      }
      settle();
    }).catch((err) => {
      console.error('getSession failed:', err);
      settle();
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'https://www.googleapis.com/auth/calendar.events.readonly',
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Force clear even if signOut API fails
    }
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    setGoogleToken(null);
    resetUser();
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
        accessToken: session?.access_token ?? null,
        googleToken,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
