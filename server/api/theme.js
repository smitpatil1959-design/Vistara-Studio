import supabase from './db-client.js';
import { ensureDeckAccess, requireProjectOwner } from '../visibility.js';
import { syncProjectTheme } from '../specSync.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const projectId = req.method === 'GET' ? req.query.projectId : req.body?.projectId;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  try {
    if (req.method === 'GET') {
      const access = await ensureDeckAccess(supabase, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
      const { data, error } = await supabase.from('projects').select('theme').eq('id', projectId).maybeSingle();
      if (error) throw error;
      return res.status(200).json(data?.theme || {});
    }

    if (req.method === 'PUT') {
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can update the theme.' });
      const theme = req.body?.theme;
      if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return res.status(400).json({ error: 'theme object required' });

      const { data, error } = await supabase.from('projects').update({ theme }).eq('id', projectId).select('theme').single();
      if (error) throw error;
      await syncProjectTheme(projectId, data?.theme || theme);
      return res.status(200).json(data?.theme || theme);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/theme] error:', err);
    const msg = err?.message || String(err || '');
    if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
      return res.status(503).json({
        error: 'Database service is currently unreachable. Please check your Supabase project configuration in .env.',
        code: 'DATABASE_UNREACHABLE',
      });
    }
    if (err?.code === 'PGRST205' || err?.code === '42P01') {
      return res.status(503).json({
        error: 'Supabase tables not initialized. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.',
        code: 'DATABASE_UNINITIALIZED',
      });
    }
    return res.status(500).json({ error: err.message || 'Theme operation failed' });
  }
}
