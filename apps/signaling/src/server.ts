import { createServer, type IncomingMessage, type Server } from "node:http";
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
export interface RunningServer { httpServer: Server; close: () => Promise<void>; config: ServerConfig }

export function configFromEnv(env = process.env): ServerConfig {
  const numeric = (name: string, fallback: number) => {
    const value = Number(env[name]); return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  return {
    port: numeric("PORT", 8080),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    maxConnections: numeric("MAX_CONNECTIONS", 500),
    maxPayloadBytes: numeric("MAX_PAYLOAD_BYTES", 70_000),
    maxMessagesPerWindow: numeric("MAX_MESSAGES_PER_WINDOW", 40),
    rateWindowMs: numeric("RATE_WINDOW_MS", 10_000),
  };
}

export function createSignalingServer(config = configFromEnv()): RunningServer {
  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" }); response.end(JSON.stringify({ error: "Not found" }));
  });
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: config.maxPayloadBytes });
  const rooms = new RoomStore(2);
  let connections = 0;
  httpServer.on("upgrade", (request, socket, head) => {
    if (!originAllowed(request, config.allowedOrigins)) { rejectUpgrade(socket, 403, "Origin not allowed"); return; }
    if (connections >= config.maxConnections) { rejectUpgrade(socket, 503, "Server busy"); return; }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => websocketServer.emit("connection", websocket, request));
  });
  websocketServer.on("connection", (socket: WebSocket) => {
    connections += 1;
    socket.once("close", () => { connections -= 1; });
    socket.on("error", () => undefined); // Avoid process errors; never log signaling payloads.
    attachSignaling(socket, rooms, config);
  });
  return {
    httpServer, config,
    close: () => new Promise((resolve, reject) => websocketServer.close(() => httpServer.close((error) => error ? reject(error) : resolve()))),
  };
}

function originAllowed(request: IncomingMessage, allowed: string[]): boolean {
  // Non-browser clients may omit Origin. Browser Origins must be explicitly allowlisted in production.
  const origin = request.headers.origin;
  return !origin || allowed.length === 0 || allowed.includes(origin);
}
function rejectUpgrade(socket: import("node:stream").Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`); socket.destroy();
}
