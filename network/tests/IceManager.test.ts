import { describe, it, expect, vi, beforeEach } from "vitest";
import { IceManager } from "../src/network/IceManager";

describe("IceManager", () => {
  describe("getIceServers", () => {
    it("returns empty array when no TURN config provided", () => {
      const servers = IceManager.getIceServers();
      expect(servers).toEqual([]);
      expect(Array.isArray(servers)).toBe(true);
    });

    it("returns single TURN server when config provided", () => {
      const config = { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" };
      const servers = IceManager.getIceServers(config);
      expect(servers).toHaveLength(1);
      expect(servers[0]).toEqual(config);
    });

    it("handles multiple TURN URLs", () => {
      const config = {
        urls: ["turn:turn1.example.com:3478", "turn:turn2.example.com:3478"],
        username: "user",
        credential: "pass",
      };
      const servers = IceManager.getIceServers(config);
      expect(servers).toHaveLength(1);
      expect(servers[0].urls).toEqual(config.urls);
    });

    it("LAN-first: no STUN servers by default", () => {
      const servers = IceManager.getIceServers();
      // Should be empty - no public STUN lookup
      expect(servers).toEqual([]);
    });
  });

  describe("candidate queueing", () => {
    let manager: IceManager;
    let mockPC: any;

    beforeEach(() => {
      manager = new IceManager();
      mockPC = {
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
      };
    });

    it("queues candidates before remote description is set", async () => {
      const candidate: RTCIceCandidateInit = {
        candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 12345 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      };

      manager.queueOrAdd(mockPC, candidate);
      expect(mockPC.addIceCandidate).not.toHaveBeenCalled();

      // Now flush
      await manager.flushQueued(mockPC);
      expect(mockPC.addIceCandidate).toHaveBeenCalledTimes(1);
    });

    it("adds candidates directly after remote description is set", async () => {
      await manager.flushQueued(mockPC); // Set remoteDescription flag

      const candidate: RTCIceCandidateInit = {
        candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 12345 typ host",
        sdpMid: "0",
      };

      manager.queueOrAdd(mockPC, candidate);
      expect(mockPC.addIceCandidate).toHaveBeenCalledTimes(1);
    });

    it("flushes queued candidates in order", async () => {
      const candidates: RTCIceCandidateInit[] = [
        { candidate: "candidate:1", sdpMid: "0" },
        { candidate: "candidate:2", sdpMid: "0" },
        { candidate: "candidate:3", sdpMid: "0" },
      ];

      candidates.forEach((c) => manager.queueOrAdd(mockPC, c));
      await manager.flushQueued(mockPC);

      expect(mockPC.addIceCandidate).toHaveBeenCalledTimes(3);
    });

    it("handles addIceCandidate failures gracefully", async () => {
      mockPC.addIceCandidate = vi.fn().mockRejectedValue(new Error("Add failed"));

      const candidate: RTCIceCandidateInit = {
        candidate: "candidate:1",
        sdpMid: "0",
      };

      manager.queueOrAdd(mockPC, candidate);
      await manager.flushQueued(mockPC);

      // Should not throw
      expect(mockPC.addIceCandidate).toHaveBeenCalled();
    });

    it("reset clears queue and remote description flag", async () => {
      const candidate: RTCIceCandidateInit = { candidate: "candidate:1", sdpMid: "0" };
      manager.queueOrAdd(mockPC, candidate);
      manager.reset();
      await manager.flushQueued(mockPC);

      // Queue was cleared, nothing to flush
      expect(mockPC.addIceCandidate).not.toHaveBeenCalled();

      // But after reset, queueing works again
      manager.queueOrAdd(mockPC, candidate);
      expect(mockPC.addIceCandidate).not.toHaveBeenCalled(); // Still queued
      await manager.flushQueued(mockPC);
      expect(mockPC.addIceCandidate).toHaveBeenCalledTimes(1);
    });
  });
});
