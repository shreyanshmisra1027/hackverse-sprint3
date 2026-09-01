import type { SignalInbound, SignalOutbound } from "./types";

type Handlers = { onMessage: (message: SignalInbound) => void; onError: (message: string) => void; onClose: () => void };

export class SignalingClient {
  private socket?: WebSocket;
  constructor(private readonly url: string, private readonly handlers: Handlers) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      this.socket.addEventListener("open", () => resolve(), { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Could not connect to the signaling service.")), { once: true });
      this.socket.addEventListener("message", ({ data }) => this.receive(data));
      this.socket.addEventListener("close", () => this.handlers.onClose());
    });
  }

  send(message: SignalOutbound): void {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("Signaling connection is not open.");
    this.socket.send(JSON.stringify(message));
  }

  close(): void { this.socket?.close(); }

  private receive(data: unknown): void {
    if (typeof data !== "string") return;
    try {
      const message = JSON.parse(data) as SignalInbound;
      if (message.type === "ERROR") this.handlers.onError(message.message);
      else this.handlers.onMessage(message);
    } catch { this.handlers.onError("Received an invalid signaling message."); }
  }
}
