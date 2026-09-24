import supabase from './db-client.js';
import { ensureDeckAccess, requireProjectOwner } from '../visibility.js';
import { enforceRateLimit } from '../ratelimit.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: 'projectId required' });
      const access = await ensureDeckAccess(supabase, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return res.status(200).json([]);
        }
        console.error('[api/chat] query error:', error.message);
        return res.status(500).json({ error: error.message || 'Database error' });
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      if (!enforceRateLimit(req, res, 'chat', 90, 3600_000)) return;
      const { project_id, role, content } = req.body || {};
      if (!project_id || !role || !content) return res.status(400).json({ error: 'project_id, role and content required' });
      if (!['user', 'assistant', 'system'].includes(role)) return res.status(400).json({ error: 'Invalid message role.' });
      if (!(await requireProjectOwner(supabase, req, project_id))) return res.status(403).json({ error: 'Only the project owner can write chat messages.' });
      if (String(content).length > 4000) return res.status(422).json({ error: 'Message too long.' });
      const { data, error } = await supabase.from('chat_messages').insert({ project_id, role, content }).select().single();
      if (error) {
        console.error('[api/chat] insert error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to save chat message' });
      }
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('chat api unhandled error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
