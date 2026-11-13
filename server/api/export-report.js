import supabase from './db-client.js';
import { buildSpecFromSlides } from '../spec/index.js';
import { buildReadinessReport } from '../export/readiness.js';
import { ensureDeckAccess } from '../visibility.js';

export const maxDuration = 60;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/** GET export readiness — schema validation + live asset probes + feature coverage notes. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, format = 'pptx' } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    const access = await ensureDeckAccess(supabase, req, projectId);
    if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
    const [{ data: specRow }, { data: project }] = await Promise.all([
      supabase.from('project_specs').select('spec').eq('project_id', projectId).maybeSingle(),
      supabase.from('projects').select('*').eq('id', projectId).single(),
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    let spec = specRow?.spec;
    if (!spec) {
      const { data: slides } = await supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
      if (!slides?.length) return res.status(422).json({ error: 'No deck generated yet.' });
      spec = buildSpecFromSlides(project, slides, 'generated');
    }

    const report = await buildReadinessReport(spec, { format: ['web', 'pdf', 'pptx'].includes(format) ? format : 'pptx', probeAssets: true, projectId });
    return res.status(200).json(report);
  } catch (err) {
    console.error('export-report error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
