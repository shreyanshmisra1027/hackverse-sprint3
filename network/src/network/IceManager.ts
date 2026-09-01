// src/network/IceManager.ts
import { IceCandidatePayload } from "./protocol";

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class IceManager {
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  /**
   * Server list, LAN-first:
   * Default: no ICE servers. Browsers advertise LAN host candidates only, so
   * no public STUN lookup or relay is involved. A deployment may explicitly
   * provide a *local* TURN server when its network topology requires it.
   */
  static getIceServers(turnConfig?: IceServerConfig): RTCIceServer[] {
    const servers: RTCIceServer[] = [];
    if (turnConfig) {
      servers.push(turnConfig as RTCIceServer);
    }
    return servers;
  }

  /** Buffer ICE candidates that arrive before setRemoteDescription resolves. */
  queueOrAdd(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): void {
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
      console.warn("[IceManager] failed to add candidate", err)
    );
  }

  async flushQueued(pc: RTCPeerConnection): Promise<void> {
    this.remoteDescriptionSet = true;
    for (const c of this.pendingCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn("[IceManager] failed to flush candidate", err);
      }
    }
    this.pendingCandidates = [];
  }

  reset(): void {
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
  }

  static toPayload(candidate: RTCIceCandidate): IceCandidatePayload {
    return { candidate: candidate.toJSON() };
  }
}
