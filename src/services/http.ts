/** Minimal typed HTTP client for the Vercel serverless API surface. */

import { supabase } from '../lib/supabase';

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly code?: string;

  constructor(message: string, status: number, requestId?: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.code = code;
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.headers) Object.assign(headers, options.headers as Record<string, string>);

  // signed-in users get bearer tokens on every call, so the server can let
  // owners into their private decks while public surfaces stay open
  if (supabase) {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, typeof data.requestId === 'string' ? data.requestId : undefined, typeof data.error === 'string' ? data.error : undefined);
  }
  return data as T;
}

/** Authenticated fetch for endpoints that return non-JSON responses. */
export async function authenticatedFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && options?.body) headers.set('Content-Type', 'application/json');
  if (supabase) {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const token = data.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(path, { ...options, headers });
}
