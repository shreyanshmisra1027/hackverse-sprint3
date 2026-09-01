import http from 'http';
import { WebSocketServer } from 'ws';
import { handleMessage, handleDisconnect } from './websocket';
import { roomStore } from './rooms';
import { IncomingMessage } from 'http';

const PORT = parseInt(process.env.PORT || '8080', 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : undefined;

const MAX_CONNECTIONS = 100;
const RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 30;
const MAX_PAYLOAD_SIZE = 64 * 1024;

interface ClientMeta {
  ip: string;
  messages: number[];
  rateLimited: boolean;
}

const clients = new Map<any, ClientMeta>();

setInterval(() => {
  roomStore.cleanupEmptyRooms();
}, 60_000);

const server = http.createServer((req, res) => {
  const allowedOrigins = ALLOWED_ORIGINS || ['*'];
  const origin = req.headers.origin || '*';
  const allowOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/' && req.url !== '/ws') {
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 && origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    if (clients.size >= MAX_CONNECTIONS) {
      ws.close(1008, 'Server at capacity');
      return;
    }

    const ip = (req.socket.remoteAddress || 'unknown');
    clients.set(ws, { ip, messages: [], rateLimited: false });

    ws.on('message', (data) => {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      if (raw.length > MAX_PAYLOAD_SIZE) {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload too large' }));
        return;
      }

      const meta = clients.get(ws);
      if (meta) {
        const now = Date.now();
        meta.messages = meta.messages.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (meta.messages.length >= MAX_MESSAGES_PER_WINDOW) {
          ws.send(JSON.stringify({ type: 'error', message: 'Rate limited' }));
          return;
        }
        meta.messages.push(now);
      }

      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      handleMessage(ws, msg);
    });

    ws.on('close', () => {
      handleDisconnect(ws);
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[Signaling] Server running on http://localhost:${PORT}`);
  console.log(`[Signaling] WebSocket endpoint: ws://localhost:${PORT}/`);
  console.log(`[Signaling] Health: http://localhost:${PORT}/health`);
  console.log(`[Signaling] Allowed origins: ${ALLOWED_ORIGINS?.join(', ') || 'all'}`);
});
