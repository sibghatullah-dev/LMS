export type RealtimeEventType =
  | 'notification.created'
  | 'forum.thread.created'
  | 'forum.reply.created'
  | 'conversation.created'
  | 'conversation.message.created';

export interface RealtimeEvent {
  type: RealtimeEventType;
  institutionId: string;
  courseId?: string;
  threadId?: string;
  conversationId?: string;
  userIds?: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();

export function publishRealtimeEvent(event: RealtimeEvent): void {
  for (const listener of [...listeners]) listener(event);
}

export function subscribeRealtimeEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
