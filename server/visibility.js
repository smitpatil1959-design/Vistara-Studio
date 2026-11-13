/**
 * Visibility model + the enforcement gate. Defaults are safe: private is
 * never exposed, unlisted requires the link, unauthenticated viewers can't
 * write visibility.
 */

import { requestToken } from './assetAccess.js';
export const VISIBILITIES = ['public', 'unlisted', 'private'];
export const DEFAULT_VISIBILITY = 'unlisted';

/** Read the visibility row; absent rows default to unlisted (link-only). */
export async function getVisibility(supabase, projectId) {
  try {
    const { data, error } = await supabase.from('project_visibility').select('visibility').eq('project_id', projectId).maybeSingle();
    if (error) throw error;
    const v = data?.visibility;
    return VISIBILITIES.includes(v) ? v : DEFAULT_VISIBILITY;
  } catch (error) {
    console.error('[visibility] Could not verify sharing permissions:', error.message);
    throw error;
  }
}

/**
 * Gate for public-facing deck reads.
 *  public   → anyone
 *  unlisted → anyone with the link
 *  private  → only signed-in viewers
 * Returns true when access should be allowed.
 */
export async function ensureDeckAccess(supabase, req, projectId) {
  const visibility = await getVisibility(supabase, projectId);
  if (visibility === 'private') {
    const token = requestToken(req);
    if (!token) return { allowed: false, reason: 'auth-required', visibility };
    const { data, error } = await supabase.auth.getUser(token).catch(() => ({ data: null, error: new Error('auth') }));
    if (error || !data?.user) return { allowed: false, reason: 'auth-required', visibility };
    const { data: project } = await supabase.from('projects').select('user_id').eq('id', projectId).maybeSingle();
    if (!project || project.user_id !== data.user.id) return { allowed: false, reason: 'forbidden', visibility };
  }
  return { allowed: true, visibility };
}

/** Mutation-level gate: a valid session token must be presented for writes. */
export async function requireSignedIn(supabase, req) {
  const token = requestToken(req);
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (error) {
    console.error('[auth] Supabase session verification failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** Return the project only when the bearer belongs to its owner. */
export async function requireProjectOwner(supabase, req, projectId) {
  const user = await requireSignedIn(supabase, req);
  if (!user) return null;
  const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error || !project || project.user_id !== user.id) return null;
  return { user, project };
}

/** Owner-side setter — the workspace link model treats the bearer as the owner. */
export async function setVisibility(supabase, projectId, visibility) {
  if (!VISIBILITIES.includes(visibility)) throw new Error('unknown visibility');
  const { error } = await supabase.from('project_visibility').upsert({ project_id: projectId, visibility, updated_at: new Date().toISOString() });
  if (error) throw error;
  return visibility;
}
