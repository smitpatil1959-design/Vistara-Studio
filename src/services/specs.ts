import type { PresentationSpec } from '../deck-spec';
import { request } from './http';

export interface SpecRow {
  project_id: string;
  spec: PresentationSpec;
  version: number;
  updated_at: string;
}

export interface SpecValidation {
  valid: boolean;
  errors: string[];
  version?: number;
}

export function getSpec(projectId: string): Promise<SpecRow> {
  return request<SpecRow>(`/api/spec?projectId=${encodeURIComponent(projectId)}`);
}

export function putSpec(projectId: string, spec: PresentationSpec): Promise<SpecValidation> {
  return request<SpecValidation>('/api/spec', { method: 'PUT', body: JSON.stringify({ projectId, spec }) });
}

export function validateSpec(spec: unknown): Promise<SpecValidation> {
  return request<SpecValidation>('/api/spec', { method: 'POST', body: JSON.stringify({ spec }) });
}
