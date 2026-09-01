import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { createSignalingServer } from "../src/server.js";

async function setup() {
  const service = createSignalingServer({ port: 0, allowedOrigins: [], maxConnections: 10, maxPayloadBytes: 70_000, maxMessagesPerWindow: 40, rateWindowMs: 10_000 });
  await new Promise<void>((resolve) => service.httpServer.listen(0, "127.0.0.1", resolve));
  const address = service.httpServer.address();
  assert(address && typeof address !== "string");
  return { service, url: `ws://127.0.0.1:${address.port}` };
}
async function client(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  return socket;
}
function next(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => socket.once("message", (value) => resolve(JSON.parse(value.toString()))));
}
const send = (socket: WebSocket, value: unknown) => socket.send(JSON.stringify(value));

test("room join forwards SDP and ICE and emits disconnect", async () => {
  const { service, url } = await setup();
  const alice = await client(url); const bob = await client(url);
  try {
    send(alice, { type: "CREATE_ROOM", roomId: "demo-room", peerId: "alice" });
    send(bob, { type: "JOIN_ROOM", roomId: "demo-room", peerId: "bob" });
    assert.deepEqual(await next(alice), { type: "PEER_JOINED", roomId: "demo-room", peerId: "bob" });
    assert.deepEqual(await next(bob), { type: "PEER_JOINED", roomId: "demo-room", peerId: "alice" });
    const offer = { type: "SDP_OFFER", roomId: "demo-room", targetPeerId: "bob", sdp: { type: "offer", sdp: "v=0\r\n" } };
    send(alice, offer); assert.deepEqual(await next(bob), offer);
    const ice = { type: "ICE_CANDIDATE", roomId: "demo-room", targetPeerId: "alice", candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 } };
    send(bob, ice); assert.deepEqual(await next(alice), ice);
    const left = next(alice); bob.close();
    assert.deepEqual(await left, { type: "PEER_LEFT", roomId: "demo-room", peerId: "bob" });
  } finally { alice.close(); bob.close(); await service.close(); }
});

test("rejects malformed messages and third peer", async () => {
  const { service, url } = await setup();
  const alice = await client(url); const bob = await client(url); const eve = await client(url);
  try {
    alice.send("{not json");
    assert.equal((await next(alice)).type, "ERROR");
    send(alice, { type: "CREATE_ROOM", roomId: "demo-room", peerId: "alice" });
    send(bob, { type: "JOIN_ROOM", roomId: "demo-room", peerId: "bob" }); await next(alice); await next(bob);
    send(eve, { type: "JOIN_ROOM", roomId: "demo-room", peerId: "eve" });
    assert.deepEqual(await next(eve), { type: "ERROR", code: "ROOM_FULL", message: "Room has reached its two-peer limit." });
  } finally { alice.close(); bob.close(); eve.close(); await service.close(); }
});
