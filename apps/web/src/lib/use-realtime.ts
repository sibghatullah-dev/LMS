'use client';

import { useEffect } from 'react';
import { useAuthStore } from './auth-store';

type RealtimeEventHandler = (type: string, data: unknown) => void;

interface RealtimeOptions {
  courseId?: string;
  threadId?: string;
  conversationId?: string;
  enabled?: boolean;
  onEvent: RealtimeEventHandler;
}

export function useRealtimeStream({
  courseId,
  threadId,
  conversationId,
  enabled = true,
  onEvent,
}: RealtimeOptions) {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!enabled || !accessToken) return;
    const url = new URL('/api/v1/realtime/stream', window.location.origin);
    url.searchParams.set('accessToken', accessToken);
    if (courseId) url.searchParams.set('courseId', courseId);
    if (threadId) url.searchParams.set('threadId', threadId);
    if (conversationId) url.searchParams.set('conversationId', conversationId);

    const source = new EventSource(url);
    const types = [
      'ready',
      'ping',
      'notification.created',
      'forum.thread.created',
      'forum.reply.created',
      'conversation.created',
      'conversation.message.created',
    ] as const;
    const handlers = types.map((type) => {
      const handler = (event: MessageEvent) => {
        try {
          onEvent(type, JSON.parse(event.data));
        } catch {
          onEvent(type, event.data);
        }
      };
      source.addEventListener(type, handler);
      return [type, handler] as const;
    });

    return () => {
      handlers.forEach(([type, handler]) => source.removeEventListener(type, handler));
      source.close();
    };
  }, [accessToken, courseId, conversationId, enabled, onEvent, threadId]);
}
