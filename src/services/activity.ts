import type { ProjectEvent } from '../types';
import { request } from './http';

/** Recent workspace activity (project events), newest first. */
export function getActivity(projectId?: string, limit = 300): Promise<ProjectEvent[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}&limit=${limit}` : `?limit=${limit}`;
  return request<ProjectEvent[]>(`/api/activity${qs}`);
}
