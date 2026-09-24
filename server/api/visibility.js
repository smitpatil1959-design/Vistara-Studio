import supabase from './db-client.js';
import { getVisibility, setVisibility, VISIBILITIES, requireProjectOwner } from '../visibility.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/** Project share visibility — GET current, PUT change. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const projectId = req.method === 'GET' ? req.query.projectId : req.body?.projectId;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single();
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (req.method === 'GET') {
      return res.status(200).json({ visibility: await getVisibility(supabase, projectId) });
    }

    if (req.method === 'PUT') {
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can change visibility.' });
      const v = req.body?.visibility;
      if (!VISIBILITIES.includes(v)) return res.status(400).json({ error: `visibility must be one of: ${VISIBILITIES.join(', ')}` });
      const out = await setVisibility(supabase, projectId, v);
      const { error: eventError } = await supabase.from('project_events').insert({ project_id: projectId, kind: 'updated' });
      if (eventError) console.warn('[api/visibility] event log failed:', eventError.message);
      return res.status(200).json({ visibility: out });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('visibility api error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
