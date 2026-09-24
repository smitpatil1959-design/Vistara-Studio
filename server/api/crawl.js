import supabase from './db-client.js';
import { analyzeWebsite } from '../engine.js';
import { enforceRateLimit } from '../ratelimit.js';
import { requireProjectOwner } from '../visibility.js';
import { CrawlBlockedError } from '../security.js';

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

  if (!enforceRateLimit(req, res, 'crawl', 15, 3600_000)) return;

  const targetUrl = req.method === 'GET' ? req.query.url : req.body?.url;
  const projectId = req.method === 'GET' ? req.query.projectId : req.body?.projectId;

  let urlToCrawl = targetUrl;

  if (!urlToCrawl && projectId) {
    try {
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can crawl this project.' });
      const { data: project, error: pErr } = await supabase.from('projects').select('url').eq('id', projectId).maybeSingle();
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
      if (project?.url) {
        urlToCrawl = project.url;
      } else {
        return res.status(404).json({ error: 'Project not found.' });
      }
    } catch (err) {
      console.warn('[api/crawl] project lookup error:', err.message);
    }
  }

  if (!urlToCrawl) {
    return res.status(400).json({ error: 'url or projectId required' });
  }

  try {
    const result = await analyzeWebsite(urlToCrawl);
    const { screenshotBuffer: _omit, ...safeResult } = result;
    return res.status(200).json(safeResult.analysis);
  } catch (err) {
    console.error('[api/crawl] error:', err);
    const msg = err?.message || String(err || '');
    if (err instanceof CrawlBlockedError) {
      const structured = err.toStructured();
      return res.status(422).json({ error: structured.message, ...structured });
    }
    if (/getaddrinfo|enotfound/i.test(msg)) {
      return res.status(422).json({
        error: `DNS lookup failed for "${urlToCrawl}". Check that the domain name is spelled correctly and resolves publicly.`,
        code: 'DNS_ERROR',
      });
    }
    if (/econnrefused|timed?out/i.test(msg)) {
      return res.status(422).json({
        error: `Could not connect to "${urlToCrawl}". The website may be offline or blocking connections.`,
        code: 'UNREACHABLE',
      });
    }
    return res.status(500).json({ error: err.message || 'Crawl failed' });
  }
}
