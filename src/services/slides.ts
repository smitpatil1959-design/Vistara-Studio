import type { Slide } from '../types';
import { request } from './http';

export type SlidePatch = Partial<Slide>;

export function getSlides(projectId: string): Promise<Slide[]> {
  return request<Slide[]>(`/api/slides?projectId=${encodeURIComponent(projectId)}`);
}

export function createSlide(row: Partial<Slide> & { project_id: string }): Promise<Slide> {
  return request<Slide>('/api/slides', { method: 'POST', body: JSON.stringify(row) });
}

export function updateSlide(id: string, fields: SlidePatch): Promise<Slide> {
  return request<Slide>('/api/slides', { method: 'PUT', body: JSON.stringify({ id, ...fields }) });
}

export function deleteSlide(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/slides', { method: 'DELETE', body: JSON.stringify({ id }) });
}

export function reorderSlides(reorder: { id: string; sort_order: number }[]): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/slides', { method: 'PUT', body: JSON.stringify({ reorder }) });
}
