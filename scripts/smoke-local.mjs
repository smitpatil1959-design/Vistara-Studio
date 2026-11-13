import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4510';
for (const [path, method, body, status] of [
  ['/', 'GET', undefined, 200],
  ['/api/health', 'GET', undefined, 200],
  ['/api/auth/signup', 'OPTIONS', undefined, 204],
  ['/api/projects', 'GET', undefined, 401],
  ['/api/projects', 'POST', '{bad', 400],
  ['/api/projects/unknown', 'GET', undefined, 404],
  ['/api/auth/signup', 'POST', JSON.stringify({ email: 'invalid', password: 'short' }), 400],
]) {
  const response = await fetch(base + path, { method, body, signal: AbortSignal.timeout(12000), headers: body ? { 'Content-Type': 'application/json' } : {} });
  assert.equal(response.status, status, `${method} ${path}`);
  if (path.startsWith('/api') && status !== 204) assert.match(response.headers.get('content-type'), /application\/json/);
  console.log(`PASS ${method} ${path} -> ${status}`);
  await response.body?.cancel();
}
