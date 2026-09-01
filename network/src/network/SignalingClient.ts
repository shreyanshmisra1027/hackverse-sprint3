// src/network/SignalingClient.ts
import { io, Socket } from "socket.io-client";
import { SignalingMessage, SignalingMessageType } from "./protocol";

type Handler = (msg: SignalingMessage) => void;

export class SignalingClient {
  private socket: Socket | null = null;
  private handlers = new Map<SignalingMessageType, Set<Handler>>();
  private peerId: string | null = null;

  connect(serverUrl: string, peerId: string): Promise<void> {
    this.peerId = peerId;
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ["websocket"], // skip long-polling, LAN doesn't need it
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10_000,
      });

      this.socket.on("connect", () => {
        this.socket!.emit("join", { peerId });
        // in connect(), alongside the existing this.socket.on("message", ...):
        this.socket.on("peer-list", (payload) => this.emitLocal("peer-list", payload));
        this.socket.on("peer-joined", (payload) => this.emitLocal("peer-joined", payload));
        this.socket.on("peer-left", (payload) => this.emitLocal("peer-left", payload));
        this.socket.on("error", (payload) => this.emitLocal("error", payload));
        resolve();
      });

      this.socket.on("connect_error", (err) => reject(err));

      this.socket.on("message", (msg: SignalingMessage) => {
        const set = this.handlers.get(msg.type);
        if (set) set.forEach((h) => h(msg));
      });

      this.socket.on("disconnect", (reason) => {
        console.warn("[SignalingClient] disconnected:", reason);
        this.emitLocal("error", { reason });
      });
    });
  }

  on(type: SignalingMessageType, handler: Handler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  off(type: SignalingMessageType, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  send(type: SignalingMessageType, to: string, payload: any): void {
    if (!this.socket?.connected) {
      console.warn("[SignalingClient] cannot send, socket not connected");
      return;
    }
    const msg: SignalingMessage = { type, from: this.peerId ?? undefined, to, payload };
    this.socket.emit("message", msg);
  }

  private emitLocal(type: SignalingMessageType, payload: any) {
    const set = this.handlers.get(type);
    if (set) set.forEach((h) => h({ type, payload }));
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

