#!/usr/bin/env node
const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function trace() {
  console.log(`[trace] Testing imports against ${BASE}...`);
  const r = await fetch(`${BASE}/src/main.tsx`);
  const txt = await r.text();
  console.log('main.tsx length:', txt.length, 'status:', r.status);
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  const imports = [];
  while ((m = re.exec(txt)) !== null) {
    imports.push(m[1]);
  }
  console.log('main.tsx imports:', imports);
  for (const imp of imports) {
    const url = imp.startsWith('/') ? `${BASE}${imp}` : `${BASE}/src/${imp}`;
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    console.log(imp, '->', res.status, ct.slice(0, 30), body.startsWith('<!doctype') ? 'HTML!' : 'OK');
  }

  // Also test App.tsx
  const appRes = await fetch(`${BASE}/src/app/App.tsx`);
  const appTxt = await appRes.text();
  console.log('App.tsx length:', appTxt.length, 'status:', appRes.status);
  const appImports = [];
  while ((m = re.exec(appTxt)) !== null) {
    appImports.push(m[1]);
  }
  console.log('App.tsx imports count:', appImports.length);
  for (const imp of appImports) {
    const url = imp.startsWith('/') ? `${BASE}${imp}` : `${BASE}/src/app/${imp}`;
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    if (body.startsWith('<!doctype')) {
      console.log('FAILED IMPORT (HTML!):', imp, '->', url);
    }
  }
  console.log('[trace] Completed.');
}

trace().catch(console.error);
