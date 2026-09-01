import type { SignalInbound } from "./types";

type Events = {
  onSignal: (message: Extract<SignalInbound, { type: "SDP_OFFER" | "SDP_ANSWER" | "ICE_CANDIDATE" }>) => void;
  onChannel: (channel: RTCDataChannel) => void;
  onState: (state: RTCPeerConnectionState) => void;
};

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export class WebRtcPeer {
  private peer?: RTCPeerConnection;
  private remotePeerId?: string;
  private queuedCandidates: RTCIceCandidateInit[] = [];
  constructor(private readonly roomId: string, private readonly events: Events) {}

  async initiate(remotePeerId: string): Promise<void> {
    this.remotePeerId = remotePeerId;
    const peer = this.ensurePeer();
    this.events.onChannel(peer.createDataChannel("p2p", { ordered: true }));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.events.onSignal({ type: "SDP_OFFER", roomId: this.roomId, targetPeerId: remotePeerId, sdp: offer });
  }

  async handle(message: Extract<SignalInbound, { type: "SDP_OFFER" | "SDP_ANSWER" | "ICE_CANDIDATE" }>, remotePeerId: string): Promise<void> {
    this.remotePeerId = remotePeerId;
    const peer = this.ensurePeer();
    if (message.type === "SDP_OFFER") {
      await peer.setRemoteDescription(message.sdp);
      await this.flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.events.onSignal({ type: "SDP_ANSWER", roomId: this.roomId, targetPeerId: remotePeerId, sdp: answer });
    } else if (message.type === "SDP_ANSWER") {
      await peer.setRemoteDescription(message.sdp);
      await this.flushCandidates();
    } else if ("candidate" in message && peer.remoteDescription) {
      await peer.addIceCandidate(message.candidate);
    } else if ("candidate" in message) {
      this.queuedCandidates.push(message.candidate);
    }
  }

  close(): void { this.peer?.close(); }

  private ensurePeer(): RTCPeerConnection {
    if (this.peer) return this.peer;
    const peer = new RTCPeerConnection(rtcConfig);
    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate && this.remotePeerId) this.events.onSignal({ type: "ICE_CANDIDATE", roomId: this.roomId, targetPeerId: this.remotePeerId, candidate: candidate.toJSON() });
    });
    peer.addEventListener("datachannel", ({ channel }) => this.events.onChannel(channel));
    peer.addEventListener("connectionstatechange", () => this.events.onState(peer.connectionState));
    this.peer = peer;
    return peer;
  }

  private async flushCandidates(): Promise<void> {
    const peer = this.ensurePeer();
    for (const candidate of this.queuedCandidates) await peer.addIceCandidate(candidate);
    this.queuedCandidates = [];
  }
}
