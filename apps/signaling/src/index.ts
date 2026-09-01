import { createSignalingServer, configFromEnv } from "./server.js";

const server = createSignalingServer(configFromEnv());
server.httpServer.listen(server.config.port, () => {
  console.log(`Signaling service listening on :${server.config.port}`);
});

function shutdown(): void {
  server.close().finally(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
