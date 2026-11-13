// A database compare-and-set prevents two serverless instances starting the same
// pipeline. Expired leases allow retry after an interrupted serverless request.
export const ACTIVE_STATUSES = new Set(['crawling', 'processing', 'identifying', 'researching', 'extracting', 'validating', 'planning', 'generating']);
const LEASE_MS = 6 * 60 * 1000;

export async function claimPipeline(db, project, status) {
  const updatedAt = Date.parse(project.updated_at || project.created_at);
  if (ACTIVE_STATUSES.has(project.status) && (!Number.isFinite(updatedAt) || Date.now() - updatedAt < LEASE_MS)) return false;
  let query = db.from('projects').update({ status, updated_at: new Date().toISOString() })
    .eq('id', project.id).eq('status', project.status);
  if (project.updated_at) query = query.eq('updated_at', project.updated_at);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setPipelineStatus(db, projectId, status, fields = {}) {
  const { error } = await db.from('projects').update({ ...fields, status, updated_at: new Date().toISOString() }).eq('id', projectId);
  if (error) throw error;
}
