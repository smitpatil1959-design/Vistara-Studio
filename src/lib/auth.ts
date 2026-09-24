/** Auth error mapping — translates Supabase/Auth errors into human-safe copy. */

export type AuthErrorCode = 'invalid' | 'duplicate' | 'unconfirmed' | 'rate-limited' | 'network' | 'server' | 'unconfigured' | 'unknown';

export interface AuthFailure {
  code: AuthErrorCode;
  message: string;
}

export function mapAuthError(error: unknown): AuthFailure {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || '');
  const msg = raw.toLowerCase();

  if (/already registered|already been registered|user already exists|duplicate key/.test(msg))
    return { code: 'duplicate', message: 'An account with this email already exists — sign in instead.' };
  if (/user not found|account not found|no user/.test(msg))
    return { code: 'invalid', message: 'No account was found with this email. Please create an account.' };
  if (/invalid login credentials|invalid_grant|invalid email or password/.test(msg))
    return { code: 'invalid', message: 'The email or password is incorrect. If you have not created an account yet, create one first.' };
  if (/email not confirmed/.test(msg))
    return { code: 'unconfirmed', message: 'Invalid email or password. Please try again.' };
  if (/rate limit|too many requests|over_request_rate_limit/.test(msg))
    return { code: 'rate-limited', message: 'Too many attempts — give it a minute and try again.' };
  if (/not configured|missing supabase/.test(msg))
    return { code: 'unconfigured', message: 'Supabase authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.' };
  if (/failed to fetch|network|load failed|fetcherror|timeout|name_not_resolved|enotfound|econnrefused|failed to load/.test(msg))
    return { code: 'network', message: 'Unable to connect to the Supabase authentication server. Please check your Supabase project URL (VITE_SUPABASE_URL) and network connectivity.' };
  if (/500|502|503|504|internal server error|bad gateway|service unavailable/.test(msg))
    return { code: 'server', message: 'Supabase authentication service is currently experiencing server issues (HTTP 5xx). Please try again shortly.' };
  return { code: 'unknown', message: raw || 'Something went wrong. Please try again.' };
}

/** sessionStorage flags for session-expiration UX */
export const SESSION_EXPIRED_FLAG = 'vistara.sessionExpired';
export const MANUAL_SIGNOUT_FLAG = 'vistara.manualSignOut';
