import generateHandler, { maxDuration } from './generate.js';
import supabase from './db-client.js';
import { ensureDeckAccess } from '../visibility.js';

export { maxDuration };

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    return generateHandler(req, res);
  }

  if (req.method === 'GET') {
    const projectId = req.query?.projectId;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    try {
      const access = await ensureDeckAccess(supabase, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: 'This presentation is private — sign in to view it.' });

      const [{ data: specRow, error: specError }, { data: slides, error: slidesError }] = await Promise.all([
        supabase.from('project_specs').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      ]);
      if (specError) throw specError;
      if (slidesError) throw slidesError;

      return res.status(200).json({
        projectId,
        spec: specRow?.spec || null,
        version: specRow?.version || null,
        slides: slides || [],
      });
    } catch (err) {
      console.error('[api/presentation] GET error:', err);
      const msg = err?.message || String(err || '');
      if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
        return res.status(503).json({
          error: 'Database service is currently unreachable. Please check your Supabase project configuration in .env.',
          code: 'DATABASE_UNREACHABLE',
        });
      }
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
