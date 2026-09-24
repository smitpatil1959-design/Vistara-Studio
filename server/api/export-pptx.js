import supabase from './db-client.js';
import { buildSpecFromSlides } from '../spec/index.js';
import { buildReadinessReport } from '../export/readiness.js';
import { buildPptx } from '../export/pptx.js';
import { ensureDeckAccess } from '../visibility.js';
import { enforceRateLimit } from '../ratelimit.js';

export const maxDuration = 60;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/** GET → binary .pptx. The readiness gate runs first; 'block' findings stop the export. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  if (!enforceRateLimit(req, res, 'export', 20, 3600_000)) return;

  try {
    const access = await ensureDeckAccess(supabase, req, projectId);
    if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
    const [{ data: project }, { data: specRow }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('project_specs').select('spec').eq('project_id', projectId).maybeSingle(),
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    let spec = specRow?.spec;
    if (!spec) {
      const { data: slides } = await supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
      if (!slides?.length) return res.status(422).json({ error: 'No deck generated yet.' });
      spec = buildSpecFromSlides(project, slides, 'generated');
    }

    // pre-flight gate — export never silently drops content or corrupt output
    const report = await buildReadinessReport(spec, { format: 'pptx', probeAssets: true });
    if (!report.ready) {
      return res.status(422).json({ error: 'Export has blocking issues', report });
    }

    const pptx = await buildPptx(spec);
    const buf = await pptx.write({ outputType: 'nodebuffer' });
    const { error: eventError } = await supabase.from('project_events').insert({ project_id: projectId, kind: 'updated' });
    if (eventError) console.warn('[api/export-pptx] event log failed:', eventError.message);

    const filename = `${(project.name || 'presentation').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-vistara.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buf.length));
    return res.status(200).end(Buffer.from(buf));
  } catch (err) {
    console.error('export-pptx error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
