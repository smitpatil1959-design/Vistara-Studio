import type { PresentationSpec } from '../deck-spec';
import { normalizePresentation, defaultThemeSpec, defaultMotionSpec } from '../deck-spec';
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

export async function getSpec(projectId: string): Promise<SpecRow> {
  const row = await request<SpecRow>(`/api/spec?projectId=${encodeURIComponent(projectId)}`);
  return { ...row, spec: normalizePresentation(row.spec, { theme: defaultThemeSpec(), motion: defaultMotionSpec() }) };
}

export function putSpec(projectId: string, spec: PresentationSpec, expectedVersion?: number): Promise<SpecValidation> {
  return request<SpecValidation>('/api/spec', { method: 'PUT', body: JSON.stringify({ projectId, spec, expectedVersion }) });
}

export function validateSpec(spec: unknown): Promise<SpecValidation> {
  return request<SpecValidation>('/api/spec', { method: 'POST', body: JSON.stringify({ spec }) });
}
