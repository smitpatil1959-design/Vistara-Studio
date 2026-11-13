import supabase from './db-client.js';
import { ensureDeckAccess, requireProjectOwner, requireSignedIn } from '../visibility.js';
import { validateTarget, CrawlBlockedError } from '../security.js';
import { syncProjectTheme } from '../specSync.js';

async function logEvent(project_id, kind) {
  try {
    const { error } = await supabase.from('project_events').insert({ project_id, kind });
    if (error) console.warn('[projects] event log failed:', error.message);
  } catch (error) {
    console.warn('[projects] event log error:', error instanceof Error ? error.message : String(error));
  }
}

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const access = await ensureDeckAccess(supabase, req, id);
        if (!access.allowed) return res.status(404).json({ error: 'This presentation is private — sign in to view it.' });
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            return res.status(404).json({ error: 'Project not found.' });
          }
          console.error('[api/projects] single query error:', error.message);
          return res.status(500).json({ error: error.message || 'Database query error' });
        }
        if (!data) return res.status(404).json({ error: 'Project not found.' });

        const { data: intake, error: intakeError } = await supabase
          .from('project_intake')
          .select('purpose, design_prompt')
          .eq('project_id', id)
          .maybeSingle();
        if (intakeError && intakeError.code !== 'PGRST116') throw intakeError;

        return res.status(200).json({ ...data, intake: intake || null, visibility: access.visibility });
      }

      // List projects (associated with authenticated user if signed in, otherwise recent workspace studies)
      const user = await requireSignedIn(supabase, req);
      if (!user) return res.status(401).json({ error: 'Sign in to view your studies.' });
      const query = supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60);

      let data = [];
      try {
        const queryResult = await query;
        if (queryResult.error) {
          if (queryResult.error.code === 'PGRST205' || queryResult.error.code === '42P01') {
            return res.status(503).json({ error: 'Database schema is not initialized. Run the latest Supabase migrations.', code: 'DATABASE_UNINITIALIZED' });
          }
          console.error('[api/projects] list query error:', queryResult.error.message);
          return res.status(503).json({ error: 'Could not load projects right now.', code: 'DATABASE_UNAVAILABLE' });
        }
        data = queryResult.data || [];
      } catch (qErr) {
        console.warn('[api/projects] list fetch warning:', qErr.message);
        return res.status(503).json({ error: 'Could not load projects right now.', code: 'DATABASE_UNAVAILABLE' });
      }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const user = await requireSignedIn(supabase, req);
      if (!user) return res.status(401).json({ error: 'Sign in to create studies.' });
      const { url, name, theme, purpose, designPrompt } = req.body || {};
      if (designPrompt !== undefined && typeof designPrompt !== 'string') return res.status(400).json({ error: 'Design direction must be text.' });
      if (!url || !String(url).trim()) return res.status(400).json({ error: 'A website URL is required.' });
      let clean = String(url).trim();
      if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
      let host = '';
      try {
        const parsed = new URL(clean);
        host = parsed.hostname.replace(/^www\./, '');
        if (!host.includes('.')) return res.status(400).json({ error: 'Enter a full domain like linear.app.' });
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
          return res.status(400).json({ error: 'Only http/https websites can be analyzed.' });
        if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host))
          return res.status(400).json({ error: 'Local or IP addresses are not reachable by the crawl engine.' });
      } catch {
        return res.status(400).json({ error: 'That URL does not look valid.' });
      }

      // Validate reachability & DNS lookup before creating the study
      try {
        await validateTarget(clean);
      } catch (targetErr) {
        if (targetErr instanceof CrawlBlockedError) {
          const structured = targetErr.toStructured();
          return res.status(400).json({ error: structured.message, code: structured.errorCode });
        }
        return res.status(400).json({
          error: `DNS lookup failed for "${host}". Please check that the website address is spelled correctly and is publicly accessible.`,
          code: 'DNS_ERROR',
        });
      }
      const PURPOSES = new Set([
        // Legacy
        'college', 'investor', 'client', 'product-demo', 'portfolio', 'general',
        // Research platform purposes
        'company_overview', 'investor_research', 'competitor_analysis',
        'product_research', 'sales_presentation', 'market_research',
      ]);
      const cleanPurpose = PURPOSES.has(purpose) ? purpose : 'general';

      const insertPayload = {
        url: clean,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 200) : host,
        status: 'queued',
        theme: theme || null,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('projects')
        .insert(insertPayload)
        .select()
        .single();
      if (error) {
        console.error('[api/projects] insert error:', error.message);
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return res.status(503).json({
            error: 'Supabase tables not initialized. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.',
            code: 'DATABASE_UNINITIALIZED'
          });
        }
        return res.status(500).json({ error: error.message || 'Failed to create project in database' });
      }

      const { error: intakeError } = await supabase
        .from('project_intake')
        .insert({ project_id: data.id, purpose: cleanPurpose, design_prompt: (designPrompt || '').slice(0, 600) || null });
      if (intakeError) {
        console.error('[api/projects] intake insert error:', intakeError.message);
        await supabase.from('projects').delete().eq('id', data.id);
        return res.status(500).json({ error: 'Study was created but its intake data could not be saved.', code: 'INTAKE_SAVE_FAILED' });
      }

      void logEvent(data.id, 'created');
      return res.status(201).json({ ...data, purpose: cleanPurpose });
    }

    if (req.method === 'PUT') {
      const { id, name, url, status, analysis, audit, understanding, dna, theme } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      if (!(await requireProjectOwner(supabase, req, id))) return res.status(403).json({ error: 'Only the project owner can edit studies.' });
      const fields = {};
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) return res.status(400).json({ error: 'A study name is required.' });
      if (theme !== undefined && (theme === null || typeof theme !== 'object' || Array.isArray(theme))) return res.status(400).json({ error: 'Theme must be an object.' });
      if (url !== undefined) {
        if (typeof url !== 'string' || !url.trim()) return res.status(400).json({ error: 'A website URL is required.' });
        const clean = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
        try { await validateTarget(clean); }
        catch (error) { return res.status(400).json({ error: error instanceof CrawlBlockedError ? error.toStructured().message : 'Website address could not be resolved.' }); }
        fields.url = clean;
      }
      if (name !== undefined) fields.name = name;
      if (status !== undefined) fields.status = status;
      if (analysis !== undefined) fields.analysis = analysis;
      if (audit !== undefined) fields.audit = audit;
      if (understanding !== undefined) fields.understanding = understanding;
      if (dna !== undefined) fields.dna = dna;
      if (theme !== undefined) fields.theme = theme;
      fields.updated_at = new Date().toISOString();

      const { data, error } = await supabase.from('projects').update(fields).eq('id', id).select().single();
      if (error) {
        console.error('[api/projects] update error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to update study' });
      }
      void logEvent(id, 'updated');
      if (theme !== undefined) await syncProjectTheme(id, theme);
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      if (!(await requireProjectOwner(supabase, req, id))) return res.status(403).json({ error: 'Only the project owner can delete studies.' });
      // Keep the database intact until storage cleanup succeeds. The final
      // project delete cascades all child tables in one database transaction.
      const { data: rows, error: assetReadError } = await supabase.from('assets').select('path, thumb_path').eq('project_id', id);
      if (assetReadError) return res.status(500).json({ error: 'Could not load study assets for deletion.', code: 'ASSET_READ_FAILED' });
      if (rows && rows.length) {
        const files = rows.flatMap((r) => [r.path, r.thumb_path].filter(Boolean));
        if (files.length) {
          const { error: storageError } = await supabase.storage.from('assets').remove(files);
          if (storageError) return res.status(500).json({ error: 'Could not remove study asset files.', code: 'ASSET_STORAGE_DELETE_FAILED' });
        }
      }
      const { error: screenshotError } = await supabase.storage.from('screenshots').remove([`${id}/home.jpg`]);
      if (screenshotError) return res.status(500).json({ error: 'Could not remove study screenshots.', code: 'SCREENSHOT_STORAGE_DELETE_FAILED' });
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        console.error('[api/projects] delete error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to delete study' });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('projects api unhandled error:', err);
    const msg = err?.message || String(err || '');
    if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
      return res.status(503).json({
        error: 'Database service is currently unreachable. Please verify your Supabase URL and network connection.',
        code: 'DATABASE_UNREACHABLE',
      });
    }
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
