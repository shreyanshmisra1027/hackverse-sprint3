import {
  createServer,
  type IncomingMessage,
  type Server,
} from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { RoomStore } from "./rooms.js";
import { attachSignaling } from "./websocket.js";
import { AuthError, AuthStore } from "./auth.js";

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
  const numeric = (name: string, fallback: number) => {
    const value = Number(env[name]);

    return Number.isSafeInteger(value) && value > 0
      ? value
      : fallback;
  };

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    port: numeric("PORT", 10000),
    allowedOrigins,

    maxConnections: numeric(
      "MAX_CONNECTIONS",
      500
    ),

    maxPayloadBytes: numeric(
      "MAX_PAYLOAD_BYTES",
      70_000
    ),

    maxMessagesPerWindow: numeric(
      "MAX_MESSAGES_PER_WINDOW",
      40
    ),

    rateWindowMs: numeric(
      "RATE_WINDOW_MS",
      10_000
    ),
  };
}

export function createSignalingServer(
  config = configFromEnv()
): RunningServer {
  const rooms = new RoomStore(2);
  const auth = new AuthStore();

  /*
   * HTTP SERVER
   *
   * Render connects to this server.
   */
  const httpServer = createServer(
    async (request, response) => {
      if (request.url?.startsWith("/api/auth/")) {
        await handleAuthRequest(request, response, auth, config.allowedOrigins);
        return;
      }
      // Health check
      if (
        request.method === "GET" &&
        request.url === "/health"
      ) {
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });

        response.end(
          JSON.stringify({
            status: "ok",
            service: "p2p-signaling",
          })
        );

        return;
      }

      // Useful WebSocket endpoint information
      if (
        request.method === "GET" &&
        request.url === "/"
      ) {
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

      response.writeHead(404, {
        "content-type": "application/json",
      });

      response.end(
        JSON.stringify({
          error: "Not found",
        })
      );
    }
  );

  /*
   * WEBSOCKET SERVER
   *
   * noServer=true means we manually handle
   * HTTP -> WebSocket upgrades below.
   */
  const websocketServer = new WebSocketServer({
    noServer: true,

    // Prevent giant signaling payloads.
    maxPayload: config.maxPayloadBytes,

    // Disable per-message compression for simplicity.
    perMessageDeflate: false,
  });

  let connections = 0;

  /*
   * HTTP -> WEBSOCKET UPGRADE
   */
  httpServer.on(
    "upgrade",
    (request, socket, head) => {
      console.log(
        `[WS] Upgrade request: ${request.url ?? "/"}`
      );

      /*
       * Only accept WebSocket requests.
       */
      const upgradeHeader =
        request.headers.upgrade;

      if (
        !upgradeHeader ||
        upgradeHeader.toLowerCase() !== "websocket"
      ) {
        console.log(
          "[WS] Rejected: invalid upgrade header"
        );

        rejectUpgrade(
          socket,
          400,
          "Bad Request"
        );

        return;
      }

      /*
       * Origin validation.
       *
       * During development, an empty ALLOWED_ORIGINS
       * means allow all origins.
       */
      if (
        !originAllowed(
          request,
          config.allowedOrigins
        )
      ) {
        console.log(
          `[WS] Rejected origin: ${
            request.headers.origin ?? "none"
          }`
        );

        rejectUpgrade(
          socket,
          403,
          "Origin Not Allowed"
        );

        return;
      }

      /*
       * Connection limit.
       */
      if (
        connections >= config.maxConnections
      ) {
        console.log(
          "[WS] Rejected: connection limit"
        );

        rejectUpgrade(
          socket,
          503,
          "Server Busy"
        );

        return;
      }

      /*
       * Upgrade the HTTP connection.
       */
      websocketServer.handleUpgrade(
        request,
        socket,
        head,
        (websocket) => {
          console.log(
            "[WS] WebSocket connection accepted"
          );

          websocketServer.emit(
            "connection",
            websocket,
            request
          );
        }
      );
    }
  );

  /*
   * NEW WEBSOCKET CONNECTION
   */
  websocketServer.on(
    "connection",
    (
      socket: WebSocket,
      request: IncomingMessage
    ) => {
      connections++;

      console.log(
        `[WS] Connected. Active connections: ${connections}`
      );

      /*
       * Basic heartbeat state.
       */
      let alive = true;

      socket.on("pong", () => {
        alive = true;
      });

      /*
       * Prevent unhandled socket errors.
       */
      socket.on("error", () => {
        // Intentionally don't log payloads.
      });

      /*
       * Attach actual signaling behavior.
       */
      attachSignaling(
        socket,
        rooms,
        config
      );

      /*
       * Cleanup.
       */
      socket.once("close", () => {
        connections = Math.max(
          0,
          connections - 1
        );

        console.log(
          `[WS] Disconnected. Active connections: ${connections}`
        );
      });

      /*
       * Keep the reference to request available for
       * future authentication/origin work.
       */
      void request;
      void alive;
    }
  );

  /*
   * HEARTBEAT
   *
   * Render may terminate idle connections.
   * This keeps active WebSocket connections alive.
   */
  const heartbeat = setInterval(() => {
    websocketServer.clients.forEach(
      (socket) => {
        if (
          socket.readyState !== 1
        ) {
          return;
        }

        try {
          socket.ping();
        } catch {
          socket.terminate();
        }
      }
    );
  }, 30_000);

  /*
   * CLEAN SHUTDOWN
   */
  const close = () =>
    new Promise<void>(
      (resolve, reject) => {
        clearInterval(heartbeat);

        websocketServer.clients.forEach(
          (socket) => {
            try {
              socket.close(1001, "Server shutting down");
            } catch {
              socket.terminate();
            }
          }
        );

        websocketServer.close(() => {
          httpServer.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
    );

  return {
    httpServer,
    close,
    config,
  };
}

async function handleAuthRequest(request: IncomingMessage, response: import("node:http").ServerResponse, auth: AuthStore, allowedOrigins: string[]): Promise<void> {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) { response.writeHead(403); response.end(); return; }
  if (origin) response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-headers", "content-type, authorization");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  try {
    const body = request.method === "POST" ? await jsonBody(request) : {};
    let result: unknown;
    if (request.method === "POST" && request.url === "/api/auth/signup") result = await auth.requestSignup(String(body.email ?? ""), String(body.username ?? ""), String(body.password ?? ""));
    else if (request.method === "POST" && request.url === "/api/auth/login") result = await auth.login(String(body.email ?? ""), String(body.password ?? ""));
    else if (request.method === "GET" && request.url === "/api/auth/me") result = { user: await auth.accountForToken(request.headers.authorization?.replace(/^Bearer\s+/i, "")) };
    else { response.writeHead(404); response.end(JSON.stringify({ error: "Not found" })); return; }
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(result ?? { ok: true }));
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
  }
}

function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> { return new Promise((resolve, reject) => { let raw = ""; request.on("data", (chunk: Buffer) => { raw += chunk; if (raw.length > 20_000) reject(new AuthError("Request too large", 413)); }); request.on("end", () => { try { resolve(JSON.parse(raw) as Record<string, unknown>); } catch { reject(new AuthError("Invalid JSON")); } }); request.on("error", reject); }); }

/*
 * ORIGIN VALIDATION
 */
function originAllowed(
  request: IncomingMessage,
  allowed: string[]
): boolean {
  const origin = request.headers.origin;

  /*
   * Non-browser clients may not send Origin.
   */
  if (!origin) {
    return true;
  }

  /*
   * Empty allowlist = development mode.
   */
  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(origin);
}

/*
 * Reject an HTTP upgrade cleanly.
 */
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
