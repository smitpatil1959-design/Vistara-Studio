import supabase from '../db-client.js';
import { ensureDeckAccess } from '../visibility.js';
import { validAssetTarget } from '../assetAccess.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const asset = { projectId: req.query?.projectId, bucket: req.query?.bucket || 'assets', path: req.query?.path };
  if (!validAssetTarget(asset)) return res.status(400).json({ error: 'Invalid image path.' });
  try {
    const access = await ensureDeckAccess(supabase, req, asset.projectId);
    if (!access.allowed) return res.status(404).json({ error: 'Image not found.' });
    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', asset.projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ error: 'Image not found.' });
    const { data, error } = await supabase.storage.from(asset.bucket).download(asset.path);
    if (error || !data) return res.status(404).json({ error: 'Image not found.' });
    if (!data.type.startsWith('image/') || data.size > 6 * 1024 * 1024) return res.status(415).json({ error: 'Unsupported image.' });
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', data.type);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).end(buffer);
  } catch (error) {
    console.error('[asset-file]', error.message);
    return res.status(503).json({ error: 'Image is temporarily unavailable.' });
  }
}
