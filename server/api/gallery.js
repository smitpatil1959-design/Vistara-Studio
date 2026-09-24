import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/** Public showcase feed — only projects whose owners marked them public. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: vis, error: visErr } = await supabase.from('project_visibility').select('project_id').eq('visibility', 'public');
    if (visErr) {
      if (visErr.code === 'PGRST205' || visErr.code === '42P01') {
        return res.status(200).json([]);
      }
      console.error('[api/gallery] visibility query error:', visErr.message);
      return res.status(500).json({ error: visErr.message || 'Database error' });
    }
    const ids = (vis || []).map((v) => v.project_id);
    if (!ids.length) return res.status(200).json([]);

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, url, status, analysis, audit, theme, created_at')
      .in('id', ids)
      .order('created_at', { ascending: false })
      .limit(24);
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return res.status(200).json([]);
      }
      console.error('[api/gallery] projects query error:', error.message);
      return res.status(500).json({ error: error.message || 'Database error' });
    }

    return res.status(200).json(
      (projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        screenshot: p.analysis?.screenshot || null,
        health: p.audit?.overall ?? null,
        sectionsReady: p.status === 'generated',
        purpose: null,
        createdAt: p.created_at,
      }))
    );
  } catch (err) {
    console.error('gallery api unhandled error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
