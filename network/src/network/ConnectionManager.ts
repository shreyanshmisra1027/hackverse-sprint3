// src/network/ConnectionManager.ts
import { SignalingClient } from "./SignalingClient";
import { PeerConnectionWrapper } from "./PeerConnection";
import { IceManager } from "./IceManager";
import { DataChannelWrapper } from "./DataChannel";
import {
  ConnectionState,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_BACKOFF_MS,
} from "./protocol";

export interface ConnectionManagerOptions {
  signalingUrl: string;
  peerId: string;
  turnConfig?: { urls: string | string[]; username?: string; credential?: string };
  onStateChange?: (state: ConnectionState) => void;
  onDataChannelReady?: (dc: DataChannelWrapper) => void;
  onPeersChanged?: (peers: string[]) => void;
}

export class ConnectionManager {
  private signaling = new SignalingClient();
  private peerConn: PeerConnectionWrapper | null = null;
  private opts: ConnectionManagerOptions;
  private remotePeerId: string | null = null;
  private reconnectAttempts = 0;
  private isOfferer = false;
  private knownPeers: Set<string> = new Set();

  constructor(opts: ConnectionManagerOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    await this.signaling.connect(this.opts.signalingUrl, this.opts.peerId);
    this.signaling.on("offer", (msg) => this.handleOffer(msg));
    this.signaling.on("answer", (msg) => this.handleAnswer(msg));
    this.signaling.on("ice-candidate", (msg) => this.handleRemoteIce(msg));
    this.signaling.on("peer-list", (msg: any) => {
      this.knownPeers = new Set(msg.payload?.peers ?? []);
      this.opts.onPeersChanged?.([...this.knownPeers]);
    });
    this.signaling.on("peer-joined", (msg: any) => {
      if (msg.payload?.peerId) {
        this.knownPeers.add(msg.payload.peerId);
        this.opts.onPeersChanged?.([...this.knownPeers]);
      }
    });
    this.signaling.on("peer-left", (msg: any) => {
      if (msg.payload?.peerId) this.knownPeers.delete(msg.payload.peerId);
      this.opts.onPeersChanged?.([...this.knownPeers]);
      this.handlePeerLeft();
    });
    this.signaling.on("error", () => this.attemptReconnect());
  }

  /** Call this on the offering side once you know who to connect to. */
  async connectToPeer(remotePeerId: string): Promise<void> {
    this.remotePeerId = remotePeerId;
    this.isOfferer = true;
    this.peerConn = this.buildPeerConnection();

    const dc = this.peerConn.createDataChannel();
    this.opts.onDataChannelReady?.(dc);

    const offer = await this.peerConn.createOffer();
    this.signaling.send("offer", remotePeerId, { sdp: offer });
  }

  private buildPeerConnection(): PeerConnectionWrapper {
    const iceServers = IceManager.getIceServers(this.opts.turnConfig);
    return new PeerConnectionWrapper(iceServers, {
      onStateChange: (state) => {
        this.opts.onStateChange?.(state);
        if (state === "failed") this.attemptReconnect();
        if (state === "connected") this.reconnectAttempts = 0;
      },
      onIceCandidate: (candidate) => {
        if (this.remotePeerId) {
          this.signaling.send("ice-candidate", this.remotePeerId, {
            candidate: candidate.toJSON(),
          });
        }
      },
      onDataChannelReady: (dc) => this.opts.onDataChannelReady?.(dc),
    });
  }

  private async handleOffer(msg: any): Promise<void> {
    this.remotePeerId = msg.from;
    this.isOfferer = false;
    this.peerConn = this.buildPeerConnection();
    const answer = await this.peerConn.createAnswer(msg.payload.sdp);
    this.signaling.send("answer", msg.from, { sdp: answer });
  }

  private async handleAnswer(msg: any): Promise<void> {
    await this.peerConn?.acceptAnswer(msg.payload.sdp);
  }

  private handleRemoteIce(msg: any): void {
    this.peerConn?.addRemoteIceCandidate(msg.payload.candidate);
  }

  private handlePeerLeft(): void {
    this.opts.onStateChange?.("closed");
    this.peerConn?.close();
    this.peerConn = null;
  }

  /** LAN reconnect: same peer, same signaling server, exponential-ish backoff. */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS || !this.remotePeerId) {
      this.opts.onStateChange?.("failed");
      return;
    }
    this.reconnectAttempts++;
    this.opts.onStateChange?.("reconnecting");

    const delay = RECONNECT_BACKOFF_MS * this.reconnectAttempts;
    setTimeout(() => {
      this.peerConn?.close();
      if (this.isOfferer && this.remotePeerId) {
        this.connectToPeer(this.remotePeerId);
      }
      // if we're the answerer, we just wait — the offerer's retry will
      // send a fresh offer and handleOffer() rebuilds our side
    }, delay);
  }

  getDataChannel(): DataChannelWrapper | undefined {
    return this.peerConn?.getDataChannel();
  }

  disconnect(): void {
    this.peerConn?.close();
    this.signaling.disconnect();
  }

  getSignalingClient(): SignalingClient {
    return this.signaling;
  }
}
