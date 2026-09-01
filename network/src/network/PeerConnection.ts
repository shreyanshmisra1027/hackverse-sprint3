// src/network/PeerConnection.ts
import { IceManager } from "./IceManager";
import { DataChannelWrapper } from "./DataChannel";
import { ConnectionState, CONNECTION_TIMEOUT_MS } from "./protocol";

export interface PeerConnectionEvents {
  onStateChange?: (state: ConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onDataChannelReady?: (dc: DataChannelWrapper) => void;
}

export class PeerConnectionWrapper {
  private pc: RTCPeerConnection;
  private ice = new IceManager();
  private dcWrapper = new DataChannelWrapper();
  private state: ConnectionState = "idle";
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private events: PeerConnectionEvents;

  constructor(iceServers: RTCIceServer[], events: PeerConnectionEvents) {
    this.events = events;
    this.pc = new RTCPeerConnection({ iceServers });
    this.wireEvents();
  }

  private wireEvents(): void {
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.events.onIceCandidate?.(ev.candidate);
    };

    this.pc.onconnectionstatechange = () => {
      switch (this.pc.connectionState) {
        case "connecting":
          this.setState("connecting");
          break;
        case "connected":
          this.clearTimeout();
          this.setState("connected");
          break;
        case "disconnected":
          this.setState("reconnecting");
          break;
        case "failed":
          this.setState("failed");
          break;
        case "closed":
          this.setState("closed");
          break;
      }
    };

    // Answering side receives the channel here
    this.pc.ondatachannel = (ev) => {
      this.dcWrapper.attach(ev.channel);
      this.events.onDataChannelReady?.(this.dcWrapper);
    };
  }

  private setState(s: ConnectionState): void {
    this.state = s;
    this.events.onStateChange?.(s);
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** Offering side creates the channel before creating the offer. */
  createDataChannel(label = "ineVITable-transfer"): DataChannelWrapper {
    const channel = this.pc.createDataChannel(label, { ordered: true });
    this.dcWrapper.attach(channel);
    this.events.onDataChannelReady?.(this.dcWrapper);
    return this.dcWrapper;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.setState("signaling");
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.startConnectTimeout();
    return offer;
  }

  async createAnswer(remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.setState("signaling");
    await this.pc.setRemoteDescription(remoteOffer);
    await this.ice.flushQueued(this.pc);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.startConnectTimeout();
    return answer;
  }

  async acceptAnswer(remoteAnswer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(remoteAnswer);
    await this.ice.flushQueued(this.pc);
  }

  addRemoteIceCandidate(candidate: RTCIceCandidateInit): void {
    this.ice.queueOrAdd(this.pc, candidate);
  }

  private startConnectTimeout(): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(() => {
      if (this.state !== "connected") {
        console.warn("[PeerConnection] connect timeout, marking failed");
        this.setState("failed");
      }
    }, CONNECTION_TIMEOUT_MS);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }

  getDataChannel(): DataChannelWrapper {
    return this.dcWrapper;
  }

  close(): void {
    this.clearTimeout();
    this.dcWrapper.close();
    this.ice.reset();
    this.pc.close();
    this.setState("closed");
  }
}
