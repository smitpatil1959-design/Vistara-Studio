// Read-only diagnostics. Never prints credentials, user rows, or project data.
import { existsSync } from 'node:fs';
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const { createClient } = await import('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log(JSON.stringify({
  backendConfigured: !!(url && key), frontendAuthConfigured: !!(clientUrl && (process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
  matchingDatabaseUrls: !!url && !!clientUrl && url.replace(/\/$/, '') === clientUrl.replace(/\/$/, ''),
  aiProvider: process.env.AI_PROVIDER || 'auto', nvidiaConfigured: !!process.env.NVIDIA_API_KEY,
  openaiConfigured: !!process.env.OPENAI_API_KEY,
}));
if (!url || !key) process.exit(1);
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(12000) }) },
});
const tables = {
  projects: 'id, user_id, status, dna, updated_at',
  slides: 'id, claim_ids, evidence_ids, source_urls, custom_label',
  project_specs: 'project_id, spec, version',
  project_intake: 'project_id, purpose, design_prompt',
  project_visibility: 'project_id, visibility',
  profiles: 'id', chat_messages: 'id', project_events: 'id', assets: 'id',
  sources: 'id, snippet, hierarchy_score, research_session_id', evidence: 'id, extracted_text, research_session_id', claims: 'id, source_urls, research_session_id', research_sessions: 'id, research_mode, status, completion_time',
};
await Promise.all(Object.entries(tables).map(async ([table, columns]) => {
  const { error } = await db.from(table).select(columns).limit(0);
  console.log(JSON.stringify({ table, ok: !error, ...(error ? { code: error.code || 'NETWORK_ERROR', message: /fetch|network/i.test(error.message) ? 'Database unreachable' : error.message } : {}) }));
}));
try {
  const { data, error } = await db.storage.listBuckets();
  console.log(JSON.stringify({ storage: !error, buckets: (data || []).filter(b => ['assets', 'screenshots'].includes(b.id)).map(b => ({ id: b.id, public: b.public })) }));
} catch { console.log(JSON.stringify({ storage: false })); }
try {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
    signal: AbortSignal.timeout(12000),
  });
  const schema = await response.json();
  console.log(JSON.stringify({ transactionalDeckSaveInstalled: !!schema.paths?.['/rpc/save_project_deck'] }));
} catch { console.log(JSON.stringify({ transactionalDeckSaveInstalled: 'unknown' })); }
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (anonKey) {
  const anonymous = createClient(url, anonKey, { auth: { persistSession: false }, global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(12000) }) } });
  for (const table of ['profiles', 'project_events', 'projects']) {
    const { data, error } = await anonymous.from(table).select('id').limit(1);
    console.log(JSON.stringify({ anonymousRead: table, exposesRows: !!data?.length, requestSucceeded: !error, ...(error ? { code: error.code || 'NETWORK_ERROR' } : {}) }));
  }
}
