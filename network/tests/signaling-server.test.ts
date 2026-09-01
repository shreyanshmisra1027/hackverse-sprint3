import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";

describe("Signaling Server", () => {
  let httpServer: any;
  let io: any;
  let serverUrl: string;
  const peers = new Map<string, string>();
  const PEER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: { origin: false },
      transports: ["websocket"],
      maxHttpBufferSize: 16 * 1024,
    });

    function peersExcept(peerId: string) {
      return [...peers.keys()].filter((id) => id !== peerId);
    }

    io.on("connection", (socket: any) => {
      socket.on("join", ({ peerId } = {} as any) => {
        if (typeof peerId !== "string" || !PEER_ID.test(peerId)) {
          socket.emit("error", { reason: "Peer ID must be 1-64 letters, numbers, _ or -" });
          return;
        }
        const existingSocketId = peers.get(peerId);
        if (existingSocketId && existingSocketId !== socket.id) {
          socket.emit("error", { reason: "Peer ID is already in use" });
          return;
        }
        socket.peerId = peerId;
        peers.set(peerId, socket.id);
        socket.emit("peer-list", { peers: peersExcept(peerId) });
        socket.broadcast.emit("peer-joined", { peerId });
      });

      socket.on("message", (message: any = {}) => {
        const { type, to, payload } = message;
        if (!socket.peerId || !["offer", "answer", "ice-candidate"].includes(type) || typeof to !== "string") {
          socket.emit("error", { reason: "Invalid signaling message" });
          return;
        }
        const targetSocketId = peers.get(to);
        if (!targetSocketId) {
          socket.emit("error", { reason: `Peer ${to} not found` });
          return;
        }
        io.to(targetSocketId).emit("message", { type, from: socket.peerId, to, payload });
      });

      socket.on("disconnect", () => {
        if (!socket.peerId || peers.get(socket.peerId) !== socket.id) return;
        peers.delete(socket.peerId);
        socket.broadcast.emit("peer-left", { peerId: socket.peerId });
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    io?.close();
    httpServer?.close();
    peers.clear();
  });

  it("validates peer ID format - accepts valid IDs", async () => {
    const validIds = ["user123", "peer-1", "test_peer", "A1", "x".repeat(64)];

    for (const peerId of validIds) {
      const client = ClientIO(serverUrl, { transports: ["websocket"] });
      const error = await new Promise<string | null>((resolve) => {
        client.on("connect", () => {
          client.emit("join", { peerId });
        });
        client.on("peer-list", () => {
          client.disconnect();
          resolve(null);
        });
        client.on("error", (err) => {
          client.disconnect();
          resolve(err.reason);
        });
        setTimeout(() => {
          client.disconnect();
          resolve("timeout");
        }, 1000);
      });
      expect(error).toBeNull();
    }
  });

  it("validates peer ID format - rejects invalid IDs", async () => {
    const invalidIds = [
      "", // empty
      "x".repeat(65), // too long
      "-invalid", // starts with -
      "_invalid", // starts with _
      "has space", // space
      "has@symbol", // special char
    ];

    for (const peerId of invalidIds) {
      const client = ClientIO(serverUrl, { transports: ["websocket"] });
      const error = await new Promise<string | null>((resolve) => {
        client.on("connect", () => {
          client.emit("join", { peerId });
        });
        client.on("error", (err) => {
          client.disconnect();
          resolve(err.reason);
        });
        client.on("peer-list", () => {
          client.disconnect();
          resolve(null);
        });
        setTimeout(() => {
          client.disconnect();
          resolve("timeout");
        }, 1000);
      });
      expect(error).not.toBeNull();
      expect(error).not.toBe("timeout");
    }
  });

  it("prevents duplicate peer IDs from different sockets", async () => {
    const peerId = `unique-${Date.now()}`;

    const client1 = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      client1.on("connect", () => {
        client1.emit("join", { peerId });
      });
      client1.on("peer-list", () => resolve());
    });

    const client2 = ClientIO(serverUrl, { transports: ["websocket"] });
    const error = await new Promise<string | null>((resolve) => {
      client2.on("connect", () => {
        client2.emit("join", { peerId });
      });
      client2.on("error", (err) => {
        client2.disconnect();
        resolve(err.reason);
      });
      setTimeout(() => {
        client2.disconnect();
        resolve("timeout");
      }, 1000);
    });

    expect(error).toBe("Peer ID is already in use");

    client1.disconnect();
  });

  it("broadcasts peer discovery - peer-list on join", async () => {
    const peerA = `peer-A-${Date.now()}`;
    const peerB = `peer-B-${Date.now()}`;

    const clientA = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      clientA.on("connect", () => clientA.emit("join", { peerId: peerA }));
      clientA.on("peer-list", () => resolve());
    });

    // Peer B joins, should see Peer A
    const clientB = ClientIO(serverUrl, { transports: ["websocket"] });
    const peerList = await new Promise<string[]>((resolve) => {
      clientB.on("connect", () => clientB.emit("join", { peerId: peerB }));
      clientB.on("peer-list", ({ peers }) => resolve(peers));
      setTimeout(() => resolve([]), 1000);
    });

    expect(peerList).toContain(peerA);
    expect(peerList).not.toContain(peerB); // Should not contain self

    clientA.disconnect();
    clientB.disconnect();
  });

  it("broadcasts peer-joined event", async () => {
    const peerA = `watcher-${Date.now()}`;
    const peerB = `joiner-${Date.now()}`;

    const watcher = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      watcher.on("connect", () => watcher.emit("join", { peerId: peerA }));
      watcher.on("peer-list", () => resolve());
    });

    const joinedPeer = await new Promise<string | null>((resolve) => {
      watcher.on("peer-joined", ({ peerId }) => resolve(peerId));
      const joiner = ClientIO(serverUrl, { transports: ["websocket"] });
      joiner.on("connect", () => joiner.emit("join", { peerId: peerB }));
      setTimeout(() => resolve(null), 1000);
    });

    expect(joinedPeer).toBe(peerB);
    watcher.disconnect();
  });

  it("broadcasts peer-left on disconnect", async () => {
    const peerA = `observer-${Date.now()}`;
    const peerB = `leaver-${Date.now()}`;

    const observer = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      observer.on("connect", () => observer.emit("join", { peerId: peerA }));
      observer.on("peer-list", () => resolve());
    });

    const leaver = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      leaver.on("connect", () => leaver.emit("join", { peerId: peerB }));
      leaver.on("peer-list", () => resolve());
    });

    const leftPeer = await new Promise<string | null>((resolve) => {
      observer.on("peer-left", ({ peerId }) => resolve(peerId));
      leaver.disconnect();
      setTimeout(() => resolve(null), 1000);
    });

    expect(leftPeer).toBe(peerB);
    observer.disconnect();
  });

  it("routes signaling messages between peers", async () => {
    const peerA = `sender-${Date.now()}`;
    const peerB = `receiver-${Date.now()}`;

    const clientA = ClientIO(serverUrl, { transports: ["websocket"] });
    const clientB = ClientIO(serverUrl, { transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((resolve) => {
        clientA.on("connect", () => clientA.emit("join", { peerId: peerA }));
        clientA.on("peer-list", () => resolve());
      }),
      new Promise<void>((resolve) => {
        clientB.on("connect", () => clientB.emit("join", { peerId: peerB }));
        clientB.on("peer-list", () => resolve());
      }),
    ]);

    const received = await new Promise<any>((resolve) => {
      clientB.on("message", (msg) => resolve(msg));
      clientA.emit("message", {
        type: "offer",
        to: peerB,
        payload: { sdp: { type: "offer", sdp: "v=0..." } },
      });
      setTimeout(() => resolve(null), 1000);
    });

    expect(received).not.toBeNull();
    expect(received.type).toBe("offer");
    expect(received.from).toBe(peerA);
    expect(received.to).toBe(peerB);
    expect(received.payload.sdp).toBeDefined();

    clientA.disconnect();
    clientB.disconnect();
  });

  it("rejects messages to non-existent peers", async () => {
    const peerA = `lonely-${Date.now()}`;

    const client = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      client.on("connect", () => client.emit("join", { peerId: peerA }));
      client.on("peer-list", () => resolve());
    });

    const error = await new Promise<string | null>((resolve) => {
      client.on("error", (err) => resolve(err.reason));
      client.emit("message", { type: "offer", to: "non-existent-peer", payload: {} });
      setTimeout(() => resolve(null), 500);
    });

    expect(error).toContain("not found");
    client.disconnect();
  });

  it("validates signaling message types", async () => {
    const peerA = `validator-${Date.now()}`;

    const client = ClientIO(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => {
      client.on("connect", () => client.emit("join", { peerId: peerA }));
      client.on("peer-list", () => resolve());
    });

    const error = await new Promise<string | null>((resolve) => {
      client.on("error", (err) => resolve(err.reason));
      // Invalid message type
      client.emit("message", { type: "invalid-type", to: "some-peer", payload: {} });
      setTimeout(() => resolve(null), 500);
    });

    expect(error).toBe("Invalid signaling message");
    client.disconnect();
  });
});
