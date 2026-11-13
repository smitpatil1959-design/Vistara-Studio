import supabase from './db-client.js';
import { ASSET_BUCKET, ASSET_MAX_INPUT_BYTES, optimizeImage, assetPath } from '../assets.js';
import { enforceRateLimit, sniffImageMime } from '../ratelimit.js';
import { ensureDeckAccess, requireProjectOwner } from '../visibility.js';
import { assetUrl } from '../assetAccess.js';

export const maxDuration = 30;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

/** Project asset library — list/upload/replace/crop/delete. */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: 'projectId required' });
      const access = await ensureDeckAccess(supabase, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: 'Not found.' });
      const { data, error } = await supabase.from('assets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(120);
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') return res.status(200).json([]);
        console.error('[api/assets] query error:', error.message);
        return res.status(500).json({ error: error.message || 'Database error' });
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { projectId, name, mime, dataBase64, kind, sourcePage } = req.body || {};
      if (!projectId || !dataBase64) return res.status(400).json({ error: 'projectId and dataBase64 required' });
      const { data: proj } = await supabase.from('projects').select('id').eq('id', projectId).single();
      if (!proj) return res.status(404).json({ error: 'Project not found.' });

      if (!enforceRateLimit(req, res, 'asset-upload', 40, 3600_000)) return;
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can upload assets.' });

      const raw = Buffer.from(String(dataBase64), 'base64');
      if (raw.length > ASSET_MAX_INPUT_BYTES) return res.status(413).json({ error: 'Image too large (max 6MB).' });
      const sniffed = sniffImageMime(raw);
      if (!sniffed) return res.status(415).json({ error: 'File is not a supported image (malformed header).' });
      const cleanMime = ALLOWED_MIME.has(mime) && sniffed === mime ? mime : sniffed;

      const opt = await optimizeImage(raw);
      const params = { contentType: opt.mime || cleanMime, upsert: true };
      const mainPath = assetPath(projectId, name || 'image', 'main', opt.mime || cleanMime);
      const { error: upErr } = await supabase.storage.from(ASSET_BUCKET).upload(mainPath, opt.main, params);
      if (upErr) throw upErr;

      let thumbPath = null;
      if (opt.thumb) {
        thumbPath = assetPath(projectId, name || 'image', 'thumb');
        const { error: thumbError } = await supabase.storage.from(ASSET_BUCKET).upload(thumbPath, opt.thumb, { contentType: 'image/jpeg', upsert: true });
        if (thumbError) {
          await supabase.storage.from(ASSET_BUCKET).remove([mainPath]);
          throw thumbError;
        }
      }

      const { data: row, error: rowErr } = await supabase
        .from('assets')
        .insert({
          project_id: projectId,
          kind: kind === 'scan' ? 'scan' : 'upload',
          name: String(name || 'image').slice(0, 120),
          path: mainPath,
          thumb_path: thumbPath,
          url: assetUrl(projectId, mainPath),
          thumb_url: thumbPath ? assetUrl(projectId, thumbPath) : null,
          width: opt.width,
          height: opt.height,
          bytes: opt.main.length,
          mime: opt.mime || cleanMime,
          source_page: sourcePage || null,
        })
        .select()
        .single();
      if (rowErr) {
        await supabase.storage.from(ASSET_BUCKET).remove([mainPath, thumbPath].filter(Boolean));
        throw rowErr;
      }
      return res.status(201).json(row);
    }

    // crop → regenerate the main asset from its stored file
    if (req.method === 'PUT') {
      const { id, crop } = req.body || {};
      if (!id || !crop) return res.status(400).json({ error: 'id and crop required' });
      const c = {
        x: Math.max(0, Math.round(Number(crop.x) || 0)),
        y: Math.max(0, Math.round(Number(crop.y) || 0)),
        w: Math.min(8000, Math.max(0, Math.round(Number(crop.w) || 0))),
        h: Math.min(8000, Math.max(0, Math.round(Number(crop.h) || 0))),
      };
      if (c.w < 8 || c.h < 8) return res.status(422).json({ error: 'Crop region too small.' });
      crop.x = c.x; crop.y = c.y; crop.w = c.w; crop.h = c.h;
      const { data: asset } = await supabase.from('assets').select('*').eq('id', id).single();
      if (!asset) return res.status(404).json({ error: 'Asset not found.' });
      if (!(await requireProjectOwner(supabase, req, asset.project_id))) return res.status(403).json({ error: 'Only the project owner can edit assets.' });

      const { data: file, error: dlErr } = await supabase.storage.from(ASSET_BUCKET).download(asset.path);
      if (dlErr) throw dlErr;
      const buf = Buffer.from(await file.arrayBuffer());
      const opt = await optimizeImage(buf, { crop });

      const { error: uploadError } = await supabase.storage.from(ASSET_BUCKET).upload(asset.path, opt.main, { contentType: opt.mime || asset.mime || 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      if (asset.thumb_path && opt.thumb) {
        const { error: thumbError } = await supabase.storage.from(ASSET_BUCKET).upload(asset.thumb_path, opt.thumb, { contentType: 'image/jpeg', upsert: true });
        if (thumbError) throw thumbError;
      }
      const stamp = `?t=${Date.now()}`;
      const { data: updated, error } = await supabase
        .from('assets')
        .update({ width: opt.width, height: opt.height, bytes: opt.main.length, url: asset.url.split('?')[0] + stamp, thumb_url: asset.thumb_url ? asset.thumb_url.split('?')[0] + stamp : null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const { data: asset } = await supabase.from('assets').select('*').eq('id', id).single();
      if (asset && !(await requireProjectOwner(supabase, req, asset.project_id))) return res.status(403).json({ error: 'Only the project owner can delete assets.' });
      if (asset) {
        const { error: storageError } = await supabase.storage.from(ASSET_BUCKET).remove([asset.path, asset.thumb_path].filter(Boolean));
        if (storageError) throw storageError;
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('assets api error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
