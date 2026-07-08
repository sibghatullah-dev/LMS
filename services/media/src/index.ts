import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';

interface Participant {
  id: string;
  joinedAt: string;
  lastSeenAt: string;
}

interface Room {
  id: string;
  status: 'active' | 'ended';
  participants: Map<string, Participant>;
  clients: Set<ServerResponse>;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  session?: {
    institutionId?: string;
    courseId?: string;
    title?: string;
    deliveryMode?: 'native' | 'zoom' | 'ms_teams';
  };
  recording: {
    status: 'idle' | 'recording' | 'processing' | 'available' | 'failed';
    storageKey?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
  };
}

interface SignalBody {
  type: string;
  from?: string;
  payload?: unknown;
}

interface JoinClaims {
  type?: string;
  institutionId?: string;
  courseId?: string;
  sessionId?: string;
  role?: string;
  sub?: string;
  exp?: number;
  iat?: number;
}

const rooms = new Map<string, Room>();
const port = Number(process.env.MEDIA_SERVICE_PORT || process.env.PORT || 3010);

function getRoom(roomId: string): Room {
  const existing = rooms.get(roomId);
  if (existing) return existing;
  const room: Room = {
    id: roomId,
    status: 'active',
    participants: new Map(),
    clients: new Set(),
    createdAt: new Date().toISOString(),
    recording: { status: 'idle' },
  };
  rooms.set(roomId, room);
  return room;
}

function base64UrlEncode(value: Buffer): string {
  return value.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string): Buffer {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + pad;
  return Buffer.from(normalized, 'base64');
}

function verifyJoinToken(token: string, roomId: string): JoinClaims | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;
  const expected = createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  if (base64UrlEncode(expected) !== signaturePart) return null;

  const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as JoinClaims;
  if (payload.type !== 'live_session_join') return null;
  if (payload.sessionId !== roomId) return null;
  if (payload.exp && Date.now() >= payload.exp * 1000) return null;
  return payload;
}

function closeRoomClients(room: Room): void {
  for (const client of room.clients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }
  room.clients.clear();
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function broadcast(room: Room, event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of room.clients) client.write(payload);
}

function roomState(room: Room) {
  return {
    id: room.id,
    status: room.status,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    session: room.session,
    participants: [...room.participants.values()],
    recording: room.recording,
  };
}

function cleanupStaleParticipants(): void {
  const staleBefore = Date.now() - 45_000;
  for (const room of rooms.values()) {
    for (const participant of room.participants.values()) {
      if (Date.parse(participant.lastSeenAt) < staleBefore) {
        room.participants.delete(participant.id);
        broadcast(room, 'presence', roomState(room));
      }
    }
    if (room.clients.size === 0 && room.participants.size === 0) rooms.delete(room.id);
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'lumora-media', rooms: rooms.size });
    return;
  }

  const match = url.pathname.match(/^\/rooms\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const roomId = decodeURIComponent(match[1]!);
  const action = match[2] ?? 'state';
  const room = getRoom(roomId);

  if (req.method === 'GET' && action === 'state') {
    sendJson(res, 200, roomState(room));
    return;
  }

  if (action === 'start' && req.method === 'POST') {
    const body = (await readJson(req)) as {
      institutionId?: string;
      courseId?: string;
      title?: string;
      deliveryMode?: 'native' | 'zoom' | 'ms_teams';
      recordingStatus?: 'idle' | 'recording' | 'processing' | 'available' | 'failed';
    };
    room.status = 'active';
    room.startedAt = room.startedAt ?? new Date().toISOString();
    room.endedAt = undefined;
    room.session = {
      institutionId: body.institutionId ?? room.session?.institutionId,
      courseId: body.courseId ?? room.session?.courseId,
      title: body.title ?? room.session?.title,
      deliveryMode: body.deliveryMode ?? room.session?.deliveryMode,
    };
    room.recording = {
      ...room.recording,
      status: body.recordingStatus ?? 'recording',
      startedAt: room.recording.startedAt ?? new Date().toISOString(),
      completedAt: undefined,
      error: undefined,
    };
    broadcast(room, 'state', roomState(room));
    broadcast(room, 'recording', room.recording);
    sendJson(res, 202, { queued: true, room: roomState(room) });
    return;
  }

  if (action === 'end' && req.method === 'POST') {
    room.status = 'ended';
    room.endedAt = new Date().toISOString();
    if (room.recording.status === 'idle' || room.recording.status === 'recording') {
      room.recording.status = 'processing';
      room.recording.completedAt = undefined;
    }
    broadcast(room, 'state', roomState(room));
    broadcast(room, 'recording', room.recording);
    broadcast(room, 'ended', roomState(room));
    closeRoomClients(room);
    sendJson(res, 202, { queued: true, room: roomState(room) });
    return;
  }

  if (req.method === 'GET' && action === 'events') {
    if (room.status === 'ended') {
      sendJson(res, 410, { error: 'Room has ended' });
      return;
    }
    const token = url.searchParams.get('token') ?? '';
    const claims = verifyJoinToken(token, room.id);
    if (!claims) {
      sendJson(res, 401, { error: 'Invalid join token' });
      return;
    }
    const participantId = claims.sub ?? url.searchParams.get('participantId') ?? `anon-${randomUUID()}`;
    const now = new Date().toISOString();
    room.participants.set(participantId, {
      id: participantId,
      joinedAt: room.participants.get(participantId)?.joinedAt ?? now,
      lastSeenAt: now,
    });

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    room.clients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify(roomState(room))}\n\n`);
    broadcast(room, 'presence', roomState(room));

    const heartbeat = setInterval(() => {
      const participant = room.participants.get(participantId);
      if (participant) participant.lastSeenAt = new Date().toISOString();
      res.write(`event: ping\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      room.clients.delete(res);
      room.participants.delete(participantId);
      broadcast(room, 'presence', roomState(room));
    });
    return;
  }

  if (req.method === 'POST' && action === 'signals') {
    if (room.status === 'ended') {
      sendJson(res, 410, { error: 'Room has ended' });
      return;
    }
    const body = (await readJson(req)) as SignalBody;
    if (!body.type || typeof body.type !== 'string') {
      sendJson(res, 400, { error: 'Signal type is required' });
      return;
    }
    broadcast(room, 'signal', {
      type: body.type,
      from: body.from,
      payload: body.payload,
      sentAt: new Date().toISOString(),
    });
    sendJson(res, 202, { queued: true });
    return;
  }

  if (action === 'recording' && req.method === 'GET') {
    sendJson(res, 200, room.recording);
    return;
  }

  if (action === 'recording' && req.method === 'POST') {
    const body = (await readJson(req)) as {
      status?: 'recording' | 'processing' | 'available' | 'failed';
      storageKey?: string;
      error?: string;
      durationSeconds?: number;
    };
    if (!body.status) {
      sendJson(res, 400, { error: 'Recording status is required' });
      return;
    }
    room.recording = {
      ...room.recording,
      status: body.status,
      storageKey: body.storageKey ?? room.recording.storageKey,
      error: body.error,
      durationSeconds: body.durationSeconds ?? room.recording.durationSeconds,
      startedAt:
        body.status === 'recording' ? room.recording.startedAt ?? new Date().toISOString() : room.recording.startedAt,
      completedAt:
        body.status === 'available' || body.status === 'failed'
          ? new Date().toISOString()
          : room.recording.completedAt,
    };
    broadcast(room, 'recording', room.recording);
    sendJson(res, 202, { queued: true, recording: room.recording });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[lumora-media] request failed', err);
    sendJson(res, 500, { error: 'Internal error' });
  });
});

setInterval(cleanupStaleParticipants, 30_000).unref();

server.listen(port, () => {
  console.log(`[lumora-media] signaling service listening on http://localhost:${port}`);
});
