const BUCKETS = new Set(['assets', 'screenshots']);
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export function assetUrl(projectId, path, bucket = 'assets') {
  return `/api/asset-file?projectId=${encodeURIComponent(projectId)}&bucket=${bucket}&path=${encodeURIComponent(path)}`;
}

export function managedAsset(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value, 'https://vistara.local');
    if (parsed.pathname === '/api/asset-file' && !/^https?:\/\//i.test(value)) {
      return { projectId: parsed.searchParams.get('projectId'), path: parsed.searchParams.get('path'), bucket: parsed.searchParams.get('bucket') || 'assets' };
    }
    const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!base || parsed.origin !== new URL(base).origin) return null;
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated)\/(assets|screenshots)\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[2]);
    return { bucket: match[1], path, projectId: path.split('/')[0] };
  } catch { return null; }
}

export function validAssetTarget(asset, projectId = asset?.projectId) {
  return !!asset && UUID.test(projectId || '') && asset.projectId === projectId && BUCKETS.has(asset.bucket)
    && typeof asset.path === 'string' && asset.path.startsWith(`${projectId}/`)
    && !asset.path.split('/').some(part => part === '..' || part === '.' || part === '') && !asset.path.includes('\\');
}

export function protectAssetUrls(value) {
  if (typeof value === 'string') {
    const asset = managedAsset(value);
    return validAssetTarget(asset) ? assetUrl(asset.projectId, asset.path, asset.bucket) : value;
  }
  if (Array.isArray(value)) return value.map(protectAssetUrls);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, protectAssetUrls(item)]));
  return value;
}

export function requestToken(req) {
  const bearer = req.headers?.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;
  const cookie = (req.headers?.cookie || '').split(';').find(value => value.trim().startsWith('vistara_session='));
  try { return cookie ? decodeURIComponent(cookie.trim().slice('vistara_session='.length)) : ''; }
  catch { return ''; }
}

export function sessionCookie(req, token = '', maxAge = 3600) {
  const secure = req.headers?.['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
  return `vistara_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${token ? maxAge : 0}${secure ? '; Secure' : ''}`;
}
