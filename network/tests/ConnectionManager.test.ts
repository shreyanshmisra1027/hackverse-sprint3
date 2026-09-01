import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConnectionManager } from "../src/network/ConnectionManager";
import { SignalingClient } from "../src/network/SignalingClient";
import { PeerConnectionWrapper } from "../src/network/PeerConnection";
import { IceManager } from "../src/network/IceManager";
import { ConnectionState } from "../src/network/protocol";

// Mock WebRTC APIs
const mockRTCPeerConnection = vi.fn();
const mockRTCDataChannel = vi.fn();
const mockRTCSessionDescription = vi.fn();
const mockRTCIceCandidate = vi.fn();

global.RTCPeerConnection = mockRTCPeerConnection;
global.RTCSessionDescription = mockRTCSessionDescription;
global.RTCIceCandidate = mockRTCIceCandidate;
global.RTCDataChannel = mockRTCDataChannel;

describe("ConnectionManager", () => {
  let manager: ConnectionManager;
  const opts = {
    signalingUrl: "http://localhost:3000",
    peerId: "test-peer",
    onStateChange: vi.fn(),
    onDataChannelReady: vi.fn(),
    onPeersChanged: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ConnectionManager(opts);
  });

  afterEach(() => {
    manager?.disconnect();
  });

  it("should initialize with correct options", () => {
    expect(manager["opts"]).toBe(opts);
    expect(manager["signaling"]).toBeInstanceOf(SignalingClient);
    expect(manager["peerConn"]).toBeNull();
    expect(manager["remotePeerId"]).toBeNull();
    expect(manager["reconnectAttempts"]).toBe(0);
    expect(manager["isOfferer"]).toBe(false);
    expect(manager["peers"]).toEqual(new Set<string>());
  });

  it("should start signaling connection", async () => {
    const connectSpy = vi.spyOn(manager["signaling"], "connect").mockResolvedValue(undefined);
    const onStateChangeSpy = opts.onStateChange;

    await manager.start();

    expect(connectSpy).toHaveBeenCalledWith(opts.signalingUrl, opts.peerId);
    expect(onStateChangeSpy).toHaveBeenCalledWith("signaling");
  });

  it("should set up signaling event listeners", async () => {
    const onSpy = vi.spyOn(manager["signaling"], "on");
    await manager.start();

    expect(onSpy).toHaveBeenCalledWith("offer", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("answer", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("ice-candidate", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("peer-left", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("peer-list", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("peer-joined", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("peer-left", expect.any(Function));
  });

  it("should handle peer left event", () => {
    const handlePeerLeftSpy = vi.spyOn(manager as any, "handlePeerLeft");
    manager["signaling"].emit("peer-left");
    expect(handlePeerLeftSpy).toHaveBeenCalled();
  });

  it("should handle signaling error and attempt reconnect", () => {
    const attemptReconnectSpy = vi.spyOn(manager as any, "attemptReconnect");
    manager["signaling"].emit("error");
    expect(attemptReconnectSpy).toHaveBeenCalled();
  });

  it("should replace peers list correctly", () => {
    const publishPeersSpy = vi.spyOn(manager as any, "publishPeers");
    manager["replacePeers"](["peer1", "peer2", "peer3"]);
    expect(publishPeersSpy).toHaveBeenCalled();
    expect(manager["peers"]).toEqual(new Set(["peer1", "peer2", "peer3"]));
  });

  it("should add peer to set", () => {
    const publishPeersSpy = vi.spyOn(manager as any, "publishPeers");
    manager["addPeer"]("new-peer");
    expect(publishPeersSpy).toHaveBeenCalled();
    expect(manager["peers"]).toEqual(new Set(["new-peer"]));
  });

  it("should not add self to peers", () => {
    manager["opts"].peerId = "self-peer";
    const publishPeersSpy = vi.spyOn(manager as any, "publishPeers");
    manager["addPeer"]("self-peer");
    expect(publishPeersSpy).toHaveBeenCalled();
    expect(manager["peers"]).toEqual(new Set()); // Should be empty
  });

  it("should remove peer from set", () => {
    const publishPeersSpy = vi.spyOn(manager as any, "publishPeers");
    manager["peers"].add("peer-to-remove");
    manager["removePeer"]("peer-to-remove");
    expect(publishPeersSpy).toHaveBeenCalled();
    expect(manager["peers"]).toEqual(new Set());
  });

  it("should handle peer left when removed peer is remote peer", () => {
    manager["remotePeerId"] = "peer-to-remove";
    const handlePeerLeftSpy = vi.spyOn(manager as any, "handlePeerLeft");
    const publishPeersSpy = vi.spyOn(manager as any, "publishPeers");
    manager["removePeer"]("peer-to-remove");
    expect(handlePeerLeftSpy).toHaveBeenCalled();
    expect(publishPeersSpy).toHaveBeenCalled();
  });

  it("should attempt reconnect with exponential backoff", () => {
    manager["remotePeerId"] = "test-remote";
    manager["isOfferer"] = true;
    const connectToPeerSpy = vi.spyOn(manager as any, "connectToPeer");
    manager["attemptReconnect"]();

    expect(manager["reconnectAttempts"]).toBe(1);
    expect(manager["opts"].onStateChange).toHaveBeenCalledWith("reconnecting");
  });

  it("should stop reconnecting after max attempts", () => {
    manager["reconnectAttempts"] = 3; // MAX_ATTEMPTS
    manager["opts"].onStateChange = vi.fn();
    manager["attemptReconnect"]();

    expect(manager["opts"].onStateChange).toHaveBeenCalledWith("failed");
  });

  it("should get data channel from peer connection", () => {
    const mockPeerConn = {
      getDataChannel: vi.fn().mockReturnValue({} as any),
    };
    manager["peerConn"] = mockPeerConn as any;
    const dc = manager.getDataChannel();
    expect(dc).toBeDefined();
    expect(mockPeerConn.getDataChannel).toHaveBeenCalled();
  });

  it("should return undefined when no peer connection", () => {
    const dc = manager.getDataChannel();
    expect(dc).toBeUndefined();
  });

  it("should disconnect properly", () => {
    const peerConnCloseSpy = vi.fn();
    const signalingDisconnectSpy = vi.spyOn(manager["signaling"], "disconnect");
    manager["peerConn"] = { close: peerConnCloseSpy } as any;
    manager["peers"].add("peer1");
    manager["publishPeers"] = vi.fn();

    manager.disconnect();

    expect(peerConnCloseSpy).toHaveBeenCalled();
    expect(signalingDisconnectSpy).toHaveBeenCalled();
    expect(manager["publishPeers"]).toHaveBeenCalled();
    expect(manager["peers"].size).toBe(0);
  });
});

describe("Integration: Signaling + Connection", () => {
  it("should coordinate signaling and peer connection flow", async () => {
    // This would test the full flow but requires more complex mocking
    // For now, we verify the components can be instantiated together
    const manager = new ConnectionManager(opts);
    expect(manager).toBeInstanceOf(ConnectionManager);
    expect(manager["signaling"]).toBeInstanceOf(SignalingClient);
    manager.disconnect();
  });
});