import supabase from './db-client.js';
import { rebuildSpec } from '../specSync.js';
import { ensureDeckAccess, requireProjectOwner } from '../visibility.js';

const sharedAccess = (req, projectId) => ensureDeckAccess(supabase, req, projectId);
const logEvent = async (project_id, kind) => {
  try {
    const { error } = await supabase.from('project_events').insert({ project_id, kind });
    if (error) console.warn('event log failed:', error.message);
  } catch (e) {
    console.warn('event log error:', e.message);
  }
};

const projectIdOf = async (slideId) => {
  if (!slideId) return null;
  try {
    const { data, error } = await supabase.from('slides').select('project_id').eq('id', slideId).maybeSingle();
    if (error || !data) return null;
    return data.project_id;
  } catch {
    return null;
  }
};

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const FIELDS = ['type', 'title', 'subtitle', 'body', 'bullets', 'stats', 'image_url', 'layout', 'animation', 'theme_override', 'sort_order'];

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: 'projectId required' });
      
      const access = await sharedAccess(req, projectId).catch(() => ({ allowed: false }));
      if (!access.allowed) return res.status(404).json({ error: 'This presentation is private — sign in to view it.' });
      
      const { data, error } = await supabase
        .from('slides')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return res.status(503).json({ error: 'Database schema is not initialized. Run the latest Supabase migrations.', code: 'DATABASE_UNINITIALIZED' });
        }
        if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(error.message || '')) {
          return res.status(503).json({ error: 'Could not load slides right now.', code: 'DATABASE_UNAVAILABLE' });
        }
        console.error('[api/slides] query error:', error.message);
        return res.status(503).json({ error: 'Could not load slides right now.', code: 'DATABASE_UNAVAILABLE' });
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body.project_id) return res.status(400).json({ error: 'project_id required' });

      // Verify parent project exists
      const { data: project, error: pErr } = await supabase
        .from('projects')
        .select('id, user_id')
        .eq('id', body.project_id)
        .maybeSingle();

      if (pErr) {
        if (pErr.code === 'PGRST205' || pErr.code === '42P01') {
          return res.status(503).json({
            error: 'Supabase tables not initialized. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.',
            code: 'DATABASE_UNINITIALIZED',
          });
        }
        throw pErr;
      }

      if (!project) {
        return res.status(404).json({ error: 'Parent study/project not found.' });
      }
      if (!(await requireProjectOwner(supabase, req, body.project_id))) return res.status(403).json({ error: 'Only the project owner can edit slides.' });

      const row = { custom_label: body.custom_label || null };
      for (const f of FIELDS) {
        if (body[f] !== undefined) row[f] = body[f];
      }
      row.project_id = body.project_id;
      if (row.sort_order === undefined) row.sort_order = 0;
      if (!row.type) row.type = 'custom';

      const { data, error } = await supabase.from('slides').insert(row).select().single();
      if (error) {
        console.error('[api/slides] insert error:', error.message);
        if (error.code === '23503') {
          return res.status(404).json({ error: 'Project not found' });
        }
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return res.status(503).json({
            error: 'Supabase tables not initialized. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.',
            code: 'DATABASE_UNINITIALIZED',
          });
        }
        return res.status(400).json({ error: error.message || 'Failed to create slide' });
      }

      void logEvent(row.project_id, 'slide_created');
      await rebuildSpec(row.project_id, 'manual-edit');
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);

      if (Array.isArray(body.reorder)) {
        if (!body.reorder.length) return res.status(200).json({ ok: true });
        const reorderProjectId = await projectIdOf(body.reorder[0]?.id);
        if (!(await requireProjectOwner(supabase, req, reorderProjectId))) return res.status(403).json({ error: 'Only the project owner can edit slides.' });
        const projectIds = await Promise.all(body.reorder.map((r) => projectIdOf(r.id)));
        if (projectIds.some((id) => !id || id !== reorderProjectId)) return res.status(403).json({ error: 'Slides must belong to the same project.' });
        
        const updates = await Promise.all(body.reorder.map((r) => supabase.from('slides').update({ sort_order: r.sort_order }).eq('id', r.id)));
        const failedUpdate = updates.find((result) => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;

        if (body.reorder[0]?.id) {
          const pid = await projectIdOf(body.reorder[0].id);
          if (pid) await rebuildSpec(pid, 'manual-edit');
        }
        return res.status(200).json({ ok: true });
      }

      if (!body.id) return res.status(400).json({ error: 'id required' });
      const fields = {};
      for (const f of FIELDS) if (body[f] !== undefined) fields[f] = body[f];
      if (body.custom_label !== undefined) fields.custom_label = body.custom_label;

      const pid = await projectIdOf(body.id);
      if (!(await requireProjectOwner(supabase, req, pid))) return res.status(403).json({ error: 'Only the project owner can edit slides.' });
      const { data, error } = await supabase.from('slides').update(fields).eq('id', body.id).select().single();
      if (error) {
        console.error('[api/slides] update error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to update slide' });
      }
      if (pid) void logEvent(pid, 'slide_updated');
      if (pid) await rebuildSpec(pid, 'manual-edit');
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });

      const pid = await projectIdOf(id);
      if (!(await requireProjectOwner(supabase, req, pid))) return res.status(403).json({ error: 'Only the project owner can edit slides.' });
      const { error } = await supabase.from('slides').delete().eq('id', id);
      if (error) {
        console.error('[api/slides] delete error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to delete slide' });
      }
      if (pid) void logEvent(pid, 'slide_deleted');
      if (pid) await rebuildSpec(pid, 'manual-edit');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('slides api unhandled error:', err);
    const msg = err?.message || String(err || '');
    if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
      return res.status(503).json({
        error: 'Database service is currently unreachable. Please check your Supabase project configuration in .env.',
        code: 'DATABASE_UNREACHABLE',
      });
    }
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
