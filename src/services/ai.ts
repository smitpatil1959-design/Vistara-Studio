import type { DeckTheme, Slide, Understanding } from '../types';
import { request } from './http';
import type { EditorProposal, PresentationSpec } from '../deck-spec';

export interface AiCommandResult {
  reply: string;
  plan: { icon: string; label: string; detail: string }[];
  context: string[];
  dropped: { op: string; reason: string; fields?: string[] }[];
  specVersion: number | null;
  changes: string[];
  slides: Slide[];
  theme: DeckTheme | null;
  understanding: Understanding | null;
  projectStatus: string | null;
}

/** Sends a natural-language direction to the deck copilot. */
export function sendAiCommand(projectId: string, command: string): Promise<AiCommandResult> {
  return request<AiCommandResult>('/api/ai', { method: 'POST', body: JSON.stringify({ projectId, command }) });
}

export function requestEditorProposal(projectId: string, command: string, spec: PresentationSpec, slideId: string, selection: string[]) {
  return request<EditorProposal>('/api/ai', { method: 'POST', body: JSON.stringify({ mode: 'proposal', projectId, command, spec, slideId, selection }) });
}
