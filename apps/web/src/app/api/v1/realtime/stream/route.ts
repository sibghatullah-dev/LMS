import { verifyAccessToken, subscribeRealtimeEvents } from '@lumora/domain';

export const runtime = 'nodejs';

function encodeEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('accessToken');
  if (!token) {
    return Response.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } },
      { status: 401 },
    );
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return Response.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } },
      { status: 401 },
    );
  }

  const courseId = url.searchParams.get('courseId') ?? undefined;
  const threadId = url.searchParams.get('threadId') ?? undefined;
  const conversationId = url.searchParams.get('conversationId') ?? undefined;
  const encoder = new TextEncoder();

  let unsubscribe: () => void = () => undefined;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          encodeEvent('ready', {
            userId: claims.userId,
            institutionId: claims.institutionId,
            courseId,
            threadId,
            conversationId,
          }),
        ),
      );

      unsubscribe = subscribeRealtimeEvents((event) => {
        if (event.institutionId !== claims.institutionId) return;
        if (courseId && event.courseId !== courseId) return;
        if (threadId && event.threadId !== threadId) return;
        if (conversationId && event.conversationId !== conversationId) return;
        if (event.userIds?.length && !event.userIds.includes(claims.userId)) return;
        controller.enqueue(encoder.encode(encodeEvent(event.type, event)));
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(encodeEvent('ping', { now: new Date().toISOString() })));
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
