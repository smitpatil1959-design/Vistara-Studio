import { protectAssetUrls, sessionCookie } from '../server/assetAccess.js';
const handlers = {
  'asset-file': () => import('../server/api/asset-file.js'),
  session: () => import('../server/api/session.js'),
  activity: () => import('../server/api/activity.js'),
  ai: () => import('../server/api/ai.js'),
  analysis: () => import('../server/api/analysis.js'),
  analyze: () => import('../server/api/analyze.js'),
  assets: () => import('../server/api/assets.js'),
  audit: () => import('../server/api/audit.js'),
  'auth-confirm': () => import('../server/api/auth-confirm.js'),
  'auth-signup': () => import('../server/api/auth-signup.js'),
  chat: () => import('../server/api/chat.js'),
  crawl: () => import('../server/api/crawl.js'),
  'export-pptx': () => import('../server/api/export-pptx.js'),
  'export-report': () => import('../server/api/export-report.js'),
  gallery: () => import('../server/api/gallery.js'),
  generate: () => import('../server/api/generate.js'),
  health: () => import('../server/api/health.js'),
  presentation: () => import('../server/api/presentation.js'),
  projects: () => import('../server/api/projects.js'),
  research: () => import('../server/api/research.js'),
  slides: () => import('../server/api/slides.js'),
  spec: () => import('../server/api/spec.js'),
  theme: () => import('../server/api/theme.js'),
  understand: () => import('../server/api/understand.js'),
  understanding: () => import('../server/api/understanding.js'),
  visibility: () => import('../server/api/visibility.js'),
};

// Vercel reads limits from the deployed entry point, not imported handlers.
export const maxDuration = 300;

export default async function handler(req, res) {
  const pathname = new URL(req.url, 'https://vistara.local').pathname;
  const parts = pathname.split('/').filter(Boolean);

  const apiParts = parts[0] === 'api' ? parts.slice(1) : parts;
  const aliases = { 'auth/signup': 'auth-signup', 'auth/confirm-email': 'auth-confirm' };
  const path = apiParts.join('/');
  const route = aliases[path] || (apiParts.length === 1 ? apiParts[0] : null);

  if (!route || !handlers[route]) {
    return res.status(404).json({
      error: 'API route not found',
    });
  }

  try {
    const json = res.json.bind(res);
    res.json = data => json(protectAssetUrls(data));
    const token = req.headers?.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (token) res.setHeader('Set-Cookie', sessionCookie(req, token));
    req.query ||= Object.fromEntries(new URL(req.url, 'https://vistara.local').searchParams);
    if (typeof req.body === 'string') {
      try { req.body = JSON.parse(req.body); }
      catch { return res.status(400).json({ error: 'Request body must be valid JSON.' }); }
    }
    if (req.body !== undefined && (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))) {
      return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }
    const module = await handlers[route]();
    return await module.default(req, res);
  } catch (error) {
    console.error(`[api-router] ${route}:`, error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
