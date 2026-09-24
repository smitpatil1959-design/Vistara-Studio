import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthFailure } from '../lib/auth';

export interface AuthResult {
  ok: boolean;
  failure: AuthFailure | null;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
