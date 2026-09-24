import supabase from './db-client.js';
import { directorTurn } from '../aiDirector.js';
import { executeOps } from '../engine.js';
import { rebuildSpec } from '../specSync.js';
import { enforceRateLimit } from '../ratelimit.js';
import { requireProjectOwner } from '../visibility.js';

export const maxDuration = 30;

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
 * POST { projectId, command } — the Creative Director.
 * Natural language → validated action plan → safe ops → canonical schema rebuilt.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // the director burns model tokens — this is the cost-control valve
  if (!enforceRateLimit(req, res, 'ai', 20, 3600_000)) return;

  const { projectId, command } = req.body || {};
  if (!projectId || !command || !String(command).trim())
    return res.status(400).json({ error: 'projectId and command required' });

  const directive = String(command).trim().slice(0, 800);

  try {
    if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can edit this project.' });
    const [{ data: project }, { data: slides }, { data: intake }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('project_intake').select('purpose, design_prompt').eq('project_id', projectId).maybeSingle(),
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!project.understanding || !project.analysis) {
      return res.status(422).json({ error: 'Run the website analysis first — I direct better with a scanned brief.' });
    }

    const { error: userChatError } = await supabase.from('chat_messages').insert({ project_id: projectId, role: 'user', content: directive });
    if (userChatError) throw userChatError;

    // plan — everything the director is about to do, with context
    const turn = directorTurn(project, slides || [], directive, {
      purpose: intake?.purpose || 'general',
      designPrompt: intake?.design_prompt || '',
    });

    // execute only what survived validation
    await executeOps(supabase, projectId, turn.ops);

    let specVersion = null;
    if (turn.hasEdits) {
      void logEvent(projectId, 'ai_edit');
      const rebuilt = await rebuildSpec(projectId, 'ai-edit').catch(() => null);
      specVersion = rebuilt ? rebuilt.version : null;
    }

    const [{ data: freshSlides }, { data: freshProject }] = await Promise.all([
      supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('projects').select('*').eq('id', projectId).single(),
    ]);

    const { error: assistantChatError } = await supabase.from('chat_messages').insert({ project_id: projectId, role: 'assistant', content: turn.reply });
    if (assistantChatError) throw assistantChatError;

    return res.status(200).json({
      reply: turn.reply,
      plan: turn.plan,
      context: turn.context,
      dropped: turn.dropped,
      changes: turn.changes,
      slides: freshSlides || [],
      theme: freshProject ? freshProject.theme : null,
      understanding: freshProject ? freshProject.understanding : null,
      projectStatus: freshProject ? freshProject.status : null,
      specVersion,
    });
  } catch (err) {
    console.error('ai api error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
