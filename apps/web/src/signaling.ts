export type JsonMessage = Record<string, unknown>;
export type SignalingStatus = "idle" | "connecting" | "connected" | "error" | "closed";

type SignalingHandlers = {
  onStatus: (status: SignalingStatus, detail?: string) => void;
  onMessage?: (message: JsonMessage) => void;
};

/** Minimal JSON WebSocket client. Room and WebRTC behavior can be added later. */
export class SignalingClient {
  private socket?: WebSocket;
  private failed = false;
  constructor(private readonly handlers: SignalingHandlers, private readonly url = import.meta.env.VITE_SIGNALING_URL) {}

  connect(): void {
    if (!this.url) { this.handlers.onStatus("error", "VITE_SIGNALING_URL is not configured."); return; }
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    this.failed = false;
    this.handlers.onStatus("connecting");
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", () => this.handlers.onStatus("connected"));
    this.socket.addEventListener("error", () => { this.failed = true; this.handlers.onStatus("error", "Could not reach the signaling server."); });
    this.socket.addEventListener("close", () => { if (!this.failed) this.handlers.onStatus("closed"); });
    this.socket.addEventListener("message", (event) => this.receive(event.data));
  }

  send(message: JsonMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("Signaling connection is not open.");
    this.socket.send(JSON.stringify(message));
  }

  close(): void { this.socket?.close(); }

  private receive(data: unknown): void {
    if (typeof data !== "string") return;
    try { this.handlers.onMessage?.(JSON.parse(data) as JsonMessage); }
    catch { this.handlers.onStatus("error", "Received invalid JSON from the signaling server."); }
  }
}
