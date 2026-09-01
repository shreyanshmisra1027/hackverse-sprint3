import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { RoomStore } from "./rooms.js";
import { attachSignaling } from "./websocket.js";

export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  maxConnections: number;
  maxPayloadBytes: number;
  maxMessagesPerWindow: number;
  rateWindowMs: number;
}

export interface RunningServer {
  httpServer: Server;
  close: () => Promise<void>;
  config: ServerConfig;
}

export function configFromEnv(env = process.env): ServerConfig {
  const numeric = (name: string, fallback: number): number => {
    const value = Number(env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    port: numeric("PORT", 10000),
    allowedOrigins,
    maxConnections: numeric("MAX_CONNECTIONS", 500),
    maxPayloadBytes: numeric("MAX_PAYLOAD_BYTES", 70_000),
    maxMessagesPerWindow: numeric("MAX_MESSAGES_PER_WINDOW", 40),
    rateWindowMs: numeric("RATE_WINDOW_MS", 10_000),
  };
}

export function createSignalingServer(
  config = configFromEnv()
): RunningServer {
  const rooms = new RoomStore(2);
  const allowedOrigins = new Set(config.allowedOrigins);

  const httpServer = createServer((request, response) => {
    handleHttpRequest(request, response, allowedOrigins).catch(
      (error: unknown) => {
        console.error("[HTTP] Unhandled error:", error);
        if (!response.headersSent) {
          response.writeHead(500, { "content-type": "application/json" });
        }
        response.end(
          JSON.stringify({ error: "Internal server error" })
        );
      }
    );
  });

  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: config.maxPayloadBytes,
    perMessageDeflate: false,
  });

  let connections = 0;

  httpServer.on("upgrade", (request, socket, head) => {
    console.log(`[WS] Upgrade request: ${request.url ?? "/"}`);

    const upgradeHeader = request.headers.upgrade;
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      console.log("[WS] Rejected: invalid upgrade header");
      rejectUpgrade(socket, 400, "Bad Request");
      return;
    }

    if (!originAllowed(request, allowedOrigins)) {
      console.log(
        `[WS] Rejected origin: ${request.headers.origin ?? "none"}`
      );
      rejectUpgrade(socket, 403, "Origin Not Allowed");
      return;
    }

    if (connections >= config.maxConnections) {
      console.log("[WS] Rejected: connection limit");
      rejectUpgrade(socket, 503, "Server Busy");
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      console.log("[WS] WebSocket connection accepted");
      websocketServer.emit("connection", websocket, request);
    });
  });

  websocketServer.on("connection", (socket: WebSocket) => {
    connections++;
    console.log(`[WS] Connected. Active connections: ${connections}`);

    socket.on("error", () => {
      // intentionally swallow — clients may disconnect abruptly
    });

    attachSignaling(socket, rooms, config);

    socket.once("close", () => {
      connections = Math.max(0, connections - 1);
      console.log(`[WS] Disconnected. Active connections: ${connections}`);
    });
  });

  // Heartbeat: keep WebSockets alive across idle proxies.
  const heartbeat = setInterval(() => {
    websocketServer.clients.forEach((socket) => {
      if (socket.readyState !== socket.OPEN) return;
      try {
        socket.ping();
      } catch {
        socket.terminate();
      }
    });
  }, 30_000);

  const close = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      clearInterval(heartbeat);

      websocketServer.clients.forEach((socket) => {
        try {
          socket.close(1001, "Server shutting down");
        } catch {
          socket.terminate();
        }
      });

      websocketServer.close(() => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    });

  return { httpServer, close, config };
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: Set<string>
): Promise<void> {
  const url = request.url ?? "/";
  const method = request.method ?? "GET";

  if (method === "GET" && url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify({ status: "ok", service: "p2p-signaling" }));
    return;
  }

  if (method === "GET" && url === "/") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(
      JSON.stringify({
        service: "p2p-signaling",
        websocket: "available",
        health: "/health",
      })
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
}

function originAllowed(
  request: IncomingMessage,
  allowed: Set<string>
): boolean {
  const origin = request.headers.origin;
  if (!origin) return true; // non-browser client
  if (allowed.size === 0) return true; // dev mode
  return allowed.has(origin);
}

function rejectUpgrade(
  socket: import("node:stream").Duplex,
  status: number,
  reason: string
): void {
  try {
    socket.write(
      `HTTP/1.1 ${status} ${reason}\r\n` +
        `Connection: close\r\n` +
        `Content-Length: 0\r\n` +
        `\r\n`
    );
  } finally {
    socket.destroy();
  }
}
