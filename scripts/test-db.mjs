import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase with Service Key...');
const sbAdmin = createClient(url, serviceKey);

async function test() {
  const { data: tables, error: tablesErr } = await sbAdmin
    .from('projects')
    .select('*')
    .limit(5);

  console.log('projects query:', { count: tables?.length, error: tablesErr });

  for (const t of ['activity', 'audits', 'assets', 'analysis', 'profiles', 'users']) {
    const { data, error } = await sbAdmin.from(t).select('*').limit(1);
    console.log(`table '${t}':`, error ? error.message : `OK (${data?.length} rows)`);
  }
}

test();
