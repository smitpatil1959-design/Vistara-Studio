import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

// Lazy singleton — createClient() must NOT be called at module scope because
// @vercel/node bundles API files at build time when env vars are not yet
// available, causing "supabaseUrl is required" → builder exits with code 1.
let _client = null;

function getClient() {
  if (_client) return _client;
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');

    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (!url || !key) {
      throw new Error('Supabase server configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  _client = createClient(
    url,
    key,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (targetUrl, options) => {
          try {
            const signal = options?.signal
              ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
              : AbortSignal.timeout(20000);
            const res = await fetch(targetUrl, { ...options, signal });
            if (!res.ok && res.status >= 500) triggerRestore();
            return res;
          } catch (fetchErr) {
            triggerRestore();
            throw fetchErr;
          }
        },
      },
    }
  );
  return _client;
}

// Export a Proxy so callers continue using `supabase.from(...)` etc. without
// any changes — the proxy transparently forwards property access to the lazily
// created client instance.
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

export default supabase;
