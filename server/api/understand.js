import supabase from './db-client.js';
import { understandWebsite } from '../understanding/service.js';
import { enforceRateLimit } from '../ratelimit.js';
import { requireProjectOwner } from '../visibility.js';

export const maxDuration = 60;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

async function logEvent(project_id, kind) {
  const { error } = await supabase.from('project_events').insert({ project_id, kind });
  if (error) console.warn('event log failed:', error.message);
}

/**
 * Re-runs the AI understanding pipeline for a project whose scan is already
 * stored. Facts are reconstructed from the persisted analysis (headings,
 * paragraphs, tech, pages, audit scores) — labels stay honest via basis flags.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // interpretation can spend model tokens — limit it
  if (!enforceRateLimit(req, res, 'understand', 12, 3600_000)) return;

  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can update understanding.' });
    const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error || !project) return res.status(404).json({ error: 'Project not found.' });
    if (!project.analysis) return res.status(422).json({ error: 'Run the website analysis first.' });

    const a = project.analysis;
    // rebuild the scan structure the interpreter consumes from stored evidence
    const scan = {
      x: {
        title: a.title || '',
        meta: { description: a.description || '', 'og:description': a.description || '', 'og:site_name': '', 'og:title': '', viewport: '' },
        lang: a.language || '',
        headings: a.headings || [],
        paragraphs: a.paragraphs || [],
        links: [],
        images: a.images || [],
        colors: a.colors || [],
        fonts: a.fonts || [],
        tech: a.tech || [],
        words: (a.pages || []).reduce((s, p) => s + (p.words || 0), 0),
        h1Count: (a.headings || []).filter((h) => h.level === 1).length,
      },
      subX: [],
      host: a.host,
      url: a.url,
      pages: a.pages || [],
      probed: a.links?.probed || [],
      robots: true,
      redirects: a.redirects || [],
      home: { status: a.status, ms: a.loadMs, html: '' },
      audit: project.audit || null,
      captureMode: a.captureMode || 'document',
    };

    const understanding = await understandWebsite(scan);
    understanding.__host = a.host;

    const { data: updated, error: uErr } = await supabase
      .from('projects')
      .update({ understanding })
      .eq('id', projectId)
      .select()
      .single();
    if (uErr) throw uErr;

    void logEvent(projectId, 'updated');
    return res.status(200).json(updated);
  } catch (err) {
    console.error('understand api error:', err);
    return res.status(500).json({ error: err.message || 'Understanding failed' });
  }
}
