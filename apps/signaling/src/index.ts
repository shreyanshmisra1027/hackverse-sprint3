import { createSignalingServer, configFromEnv } from "./server.js";

const server = createSignalingServer(configFromEnv());
server.httpServer.listen(server.config.port, "0.0.0.0", () => {
  console.log(`Signaling service listening on :${server.config.port}`);
  console.log("WebSocket endpoint: ws(s)://<host>/");
  console.log("Health endpoint: /health");
});

function shutdown(): void {
  server.close().finally(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
