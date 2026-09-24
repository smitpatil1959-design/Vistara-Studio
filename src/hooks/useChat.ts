import { useCallback, useEffect, useState } from 'react';
import type { ChatMsg, ChatRole } from '../types';
import { getChat } from '../services';

interface ChatState {
  messages: ChatMsg[];
  push: (role: ChatRole, content: string) => void;
  replace: (messages: ChatMsg[]) => void;
}

let optimisticId = -1;

/** Chat transcript for a project — server-backed, with optimistic local appends. */
export function useChat(projectId: string): ChatState {
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  useEffect(() => {
    getChat(projectId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [projectId]);

  const push = useCallback(
    (role: ChatRole, content: string) => {
      setMessages((m) => [
        ...m,
        {
          id: optimisticId--,
          project_id: projectId,
          role,
          content,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [projectId]
  );

  const replace = useCallback((next: ChatMsg[]) => setMessages(next), []);

  return { messages, push, replace };
}
