import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined)?.trim() ||
  ''
).replace(/^["']|["']$/g, '');

const rawAnonKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  ''
).replace(/^["']|["']$/g, '');

function isValidSupabaseUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}

export const supabaseUrl: string | null = isValidSupabaseUrl(rawUrl) ? rawUrl : null;
export const supabaseAnonKey: string | null = rawAnonKey && rawAnonKey.length > 10 ? rawAnonKey : null;
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabaseAnonKey);

/** Shared browser client — used for client auth/session only; never uses service role key. */
export const supabase: SupabaseClient | null = isSupabaseConfigured && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'vistara-studio-auth',
      },
    })
  : null;

export const authAvailable = supabase !== null;
