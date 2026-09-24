import supabase from './db-client.js';
import { analyzeWebsite } from '../engine.js';
import { enforceRateLimit } from '../ratelimit.js';
import { requireProjectOwner } from '../visibility.js';

export const maxDuration = 60;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, 'audit', 15, 3600_000)) return;

  const targetUrl = req.method === 'GET' ? req.query.url : req.body?.url;
  const projectId = req.method === 'GET' ? req.query.projectId : req.body?.projectId;

  if (projectId) {
    try {
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can audit this project.' });
      const { data: project, error: pErr } = await supabase.from('projects').select('id, audit, url').eq('id', projectId).maybeSingle();
      if (pErr) {
        const msg = pErr.message || '';
        if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
          return res.status(503).json({
            error: 'Database service is currently unreachable. Please check your Supabase project configuration in .env.',
            code: 'DATABASE_UNREACHABLE',
          });
        }
        if (pErr.code === 'PGRST205' || pErr.code === '42P01') {
          return res.status(503).json({
            error: 'Supabase tables not initialized. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.',
            code: 'DATABASE_UNINITIALIZED',
          });
        }
      }

      if (!project && !targetUrl) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      if (project?.audit) {
        return res.status(200).json(project.audit);
      }

      if (!targetUrl && project?.url) {
        const result = await analyzeWebsite(project.url);
        const { error: updateError } = await supabase
          .from('projects')
          .update({ audit: result.audit, analysis: result.analysis })
          .eq('id', projectId);
        if (updateError) throw updateError;
        return res.status(200).json(result.audit);
      }
    } catch (err) {
      console.warn('[api/audit] project lookup warning:', err.message);
    }
  }

  if (!targetUrl) {
    return res.status(400).json({ error: 'url or projectId required' });
  }

  try {
    const result = await analyzeWebsite(targetUrl);
    return res.status(200).json(result.audit);
  } catch (err) {
    console.error('[api/audit] error:', err);
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
    return res.status(500).json({ error: err.message || 'Audit failed' });
  }
}
