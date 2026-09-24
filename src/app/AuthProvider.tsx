import { useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MANUAL_SIGNOUT_FLAG, SESSION_EXPIRED_FLAG, mapAuthError, type AuthFailure } from '../lib/auth';
import { AuthContext, type AuthContextValue, type AuthResult } from './auth-context';

const OK: AuthResult = { ok: true, failure: null };
const fail = (error: unknown, codeOverride?: AuthFailure): AuthResult => ({
  ok: false,
  failure: codeOverride ?? mapAuthError(error),
});

/** Safely ensure a user profile exists in public.profiles */
async function ensureUserProfile(user: User | { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  if (!supabase || !user?.id) return;
  try {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!existing) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email || '',
        display_name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User',
      });
    }
  } catch {
    // Non-blocking: table might not be in schema cache yet, or managed by postgres trigger
  }
}

/** Global auth state — session persistence is handled by supabase-js (localStorage). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      const id = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(id);
    }
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (mounted) {
          if (error) {
            console.warn('[auth] getSession warning:', error.message);
          }
          setSession(data?.session ?? null);
          if (data?.session?.user) {
            void ensureUserProfile(data.session.user);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.warn('[auth] getSession network/DNS error:', err);
          setSession(null);
          setLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        const manual = sessionStorage.getItem(MANUAL_SIGNOUT_FLAG) === '1';
        sessionStorage.removeItem(MANUAL_SIGNOUT_FLAG);
        if (!manual) sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
        if (nextSession?.user) {
          void ensureUserProfile(nextSession.user);
        }
      }
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isAuthenticated: !!session,

      async signIn(email, password) {
        if (!supabase) {
          return fail(null, {
            code: 'unconfigured',
            message: 'Supabase authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env / Vercel.',
          });
        }
        try {
          const cleanEmail = email.trim();
          const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (error) {
            return fail(error);
          }
          if (data.user) {
            void ensureUserProfile(data.user);
          }
          return OK;
        } catch (e) {
          return fail(e);
        }
      },

      async signUp(email, password) {
        if (!supabase) {
          return fail(null, {
            code: 'unconfigured',
            message: 'Supabase authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env / Vercel.',
          });
        }
        try {
          const cleanEmail = email.trim();
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return fail(null, mapAuthError(data.error || data.message || 'Signup failed'));
          return OK;
        } catch (e) {
          return fail(e);
        }
      },

      async signOut() {
        sessionStorage.setItem(MANUAL_SIGNOUT_FLAG, '1');
        setSession(null);
        if (supabase) {
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('[auth] signOut error:', e);
          }
        }
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
