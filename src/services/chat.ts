import type { ChatMsg } from '../types';
import { request } from './http';

export function getChat(projectId: string): Promise<ChatMsg[]> {
  return request<ChatMsg[]>(`/api/chat?projectId=${encodeURIComponent(projectId)}`);
}
