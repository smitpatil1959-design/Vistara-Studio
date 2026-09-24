const handlers = {
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
  'db-wake': () => import('../server/api/db-wake.js'),
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

export default async function handler(req, res) {
  const pathname = new URL(req.url, 'https://vistara.local').pathname;
  const parts = pathname.split('/').filter(Boolean);

  const route = parts[0] === 'api' ? parts[1] : parts[0];

  if (!route || !handlers[route]) {
    return res.status(404).json({
      error: 'API route not found',
    });
  }

  try {
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
