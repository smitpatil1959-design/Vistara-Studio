import type { CreateStudyInput, DeckTheme, Project, ProjectStatus, PresentationPurpose, Understanding, ResearchSession, ResearchSource, ResearchEvidence, ResearchClaim } from '../types';
import { request } from './http';

export interface ProjectPatch {
  name?: string;
  url?: string;
  status?: ProjectStatus;
  understanding?: Understanding;
  theme?: DeckTheme;
}

/** Project row plus the intake fields supplied at creation. */
export type ProjectWithIntake = Project & { purpose?: PresentationPurpose };

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}

export function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects?id=${encodeURIComponent(id)}`);
}

export function createProject(input: CreateStudyInput, theme?: DeckTheme): Promise<ProjectWithIntake> {
  return request<ProjectWithIntake>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      url: input.url,
      purpose: input.purpose,
      designPrompt: input.designPrompt,
      theme,
    }),
  });
}

export function updateProject(id: string, fields: ProjectPatch): Promise<Project> {
  return request<Project>('/api/projects', { method: 'PUT', body: JSON.stringify({ id, ...fields }) });
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/projects', { method: 'DELETE', body: JSON.stringify({ id }) });
}

export interface GalleryItem {
  id: string;
  name: string;
  url: string;
  screenshot: string | null;
  health: number | null;
  sectionsReady: boolean;
  createdAt: string;
}

export function listGallery(): Promise<GalleryItem[]> {
  return request<GalleryItem[]>('/api/gallery');
}

export type DeckVisibility = 'public' | 'unlisted' | 'private';

export function getVisibility(projectId: string): Promise<{ visibility: DeckVisibility }> {
  return request<{ visibility: DeckVisibility }>(`/api/visibility?projectId=${encodeURIComponent(projectId)}`);
}

export function setDeckVisibility(projectId: string, visibility: DeckVisibility): Promise<{ visibility: DeckVisibility }> {
  return request('/api/visibility', { method: 'PUT', body: JSON.stringify({ projectId, visibility }) });
}

/** Runs the live internet research pipeline (identify → crawl → research → evidence → claims). */
export function analyzeProject(projectId: string): Promise<Project> {
  return request<Project>('/api/analyze', { method: 'POST', body: JSON.stringify({ projectId }) });
}

/** Generates 8–15 slides from verified research claims. */
export function generatePresentation(projectId: string): Promise<{ slides: import('../types').Slide[] }> {
  return request<{ slides: import('../types').Slide[] }>('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

/** Get research session status for a project. */
export function getResearchStatus(projectId: string): Promise<ResearchSession> {
  return request<ResearchSession>(`/api/research?projectId=${encodeURIComponent(projectId)}`);
}

/** Get sources collected during research. */
export function getResearchSources(projectId: string): Promise<{ sources: ResearchSource[]; count: number }> {
  return request<{ sources: ResearchSource[]; count: number }>(`/api/research?projectId=${encodeURIComponent(projectId)}&r=sources`);
}

/** Get evidence items extracted from sources. */
export function getResearchEvidence(projectId: string): Promise<{ evidence: ResearchEvidence[]; count: number }> {
  return request<{ evidence: ResearchEvidence[]; count: number }>(`/api/research?projectId=${encodeURIComponent(projectId)}&r=evidence`);
}

/** Get verified + supported claims from research. */
export function getResearchClaims(projectId: string): Promise<{ claims: ResearchClaim[]; count: number }> {
  return request<{ claims: ResearchClaim[]; count: number }>(`/api/research?projectId=${encodeURIComponent(projectId)}&r=claims`);
}
