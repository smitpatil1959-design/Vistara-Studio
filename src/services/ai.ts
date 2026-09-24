import type { DeckTheme, Slide, Understanding } from '../types';
import { request } from './http';

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
