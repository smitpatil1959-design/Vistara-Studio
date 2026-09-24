import supabase from './db-client.js';
import { ensureDeckAccess, requireSignedIn } from '../visibility.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/** Recent project activity — powers "last updated" and recent-work views. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireSignedIn(supabase, req);
    if (!user && !req.query.projectId) return res.status(401).json({ error: 'Sign in to view activity.' });
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '300'), 10) || 300));
    let q = supabase.from('project_events').select('*').order('created_at', { ascending: false }).limit(limit);
    if (req.query.projectId) {
      const access = await ensureDeckAccess(supabase, req, req.query.projectId);
      if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
      q = q.eq('project_id', req.query.projectId);
    } else if (user) {
      const { data: projects, error: projectError } = await supabase.from('projects').select('id').eq('user_id', user.id);
      if (projectError) throw projectError;
      const projectIds = (projects || []).map((project) => project.id);
      if (!projectIds.length) return res.status(200).json([]);
      q = q.in('project_id', projectIds);
    }
    let data = [];
    try {
      const queryResult = await q;
      if (queryResult.error) {
        if (queryResult.error.code === 'PGRST205' || queryResult.error.code === '42P01') {
          return res.status(503).json({ error: 'Database schema is not initialized. Run the latest Supabase migrations.', code: 'DATABASE_UNINITIALIZED' });
        }
        console.error('[api/activity] query error:', queryResult.error.message);
        return res.status(503).json({ error: 'Could not load activity right now.', code: 'DATABASE_UNAVAILABLE' });
      }
      data = queryResult.data || [];
    } catch (qErr) {
      console.warn('[api/activity] fetch warning:', qErr.message);
      return res.status(503).json({ error: 'Could not load activity right now.', code: 'DATABASE_UNAVAILABLE' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('activity api unhandled error:', err);
    return res.status(503).json({ error: 'Could not load activity right now.', code: 'DATABASE_UNAVAILABLE' });
  }
}
