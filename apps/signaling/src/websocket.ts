import { WebSocket, type RawData } from "ws";
import { errorMessage, type ClientMessage, type ServerMessage } from "./protocol.js";
import { RoomStore } from "./rooms.js";
import { parseClientMessage } from "./validation.js";

const OPEN = WebSocket.OPEN;
interface ConnectionState { roomId?: string; peerId?: string; timestamps: number[] }

export interface SignalingOptions { maxMessagesPerWindow: number; rateWindowMs: number }

export function send(socket: WebSocket, message: ServerMessage | ClientMessage): void {
  if (socket.readyState === OPEN) socket.send(JSON.stringify(message));
}

export function attachSignaling(socket: WebSocket, rooms: RoomStore, options: SignalingOptions): void {
  const state: ConnectionState = { timestamps: [] };
  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) { send(socket, errorMessage("INVALID_MESSAGE", "Binary messages are not supported.")); return; }
    const now = Date.now();
    state.timestamps = state.timestamps.filter((time) => now - time < options.rateWindowMs);
    if (state.timestamps.length >= options.maxMessagesPerWindow) {
      send(socket, errorMessage("RATE_LIMITED", "Too many messages; connection closed."));
      socket.close(1008, "Rate limit exceeded");
      return;
    }
    state.timestamps.push(now);
    const raw = data.toString();
    const message = parseClientMessage(raw);
    if ("error" in message) { send(socket, errorMessage("INVALID_MESSAGE", message.error)); return; }
    handleMessage(socket, rooms, state, message);
  });
  socket.on("close", () => {
    if (!state.roomId || !state.peerId) return;
    const remaining = rooms.remove(state.roomId, state.peerId);
    for (const peer of remaining) send(peer.socket, { type: "PEER_LEFT", roomId: state.roomId, peerId: state.peerId });
  });
}

function handleMessage(socket: WebSocket, rooms: RoomStore, state: ConnectionState, message: ClientMessage): void {
  if (message.type === "CREATE_ROOM" || message.type === "JOIN_ROOM") {
    if (state.roomId) { send(socket, errorMessage("ALREADY_JOINED", "A connection can belong to one room.")); return; }
    if (message.type === "CREATE_ROOM") {
      const result = rooms.create(message.roomId, { peerId: message.peerId, socket });
      if (result !== "ok") { send(socket, errorMessage(result, "Room already exists.")); return; }
      state.roomId = message.roomId; state.peerId = message.peerId;
      return;
    }
    const result = rooms.join(message.roomId, { peerId: message.peerId, socket });
    if (result.result !== "ok") { send(socket, errorMessage(result.result, roomError(result.result))); return; }
    state.roomId = message.roomId; state.peerId = message.peerId;
    // Tell both sides about their counterpart; a two-peer room stays intentionally simple.
    for (const peer of result.existing) {
      send(peer.socket, { type: "PEER_JOINED", roomId: message.roomId, peerId: message.peerId });
      send(socket, { type: "PEER_JOINED", roomId: message.roomId, peerId: peer.peerId });
    }
    return;
  }
  if (!state.roomId || !state.peerId || !rooms.hasPeer(message.roomId, state.peerId, socket)) {
    send(socket, errorMessage("NOT_IN_ROOM", "Join the specified room before signaling.")); return;
  }
  const target = rooms.getPeer(message.roomId, message.targetPeerId);
  if (!target || target.socket === socket) { send(socket, errorMessage("PEER_NOT_FOUND", "Target peer is not in this room.")); return; }
  // Validation has narrowed the schema; only a permitted peer receives the payload.
  send(target.socket, message);
}

function roomError(code: string): string {
  if (code === "ROOM_NOT_FOUND") return "Room does not exist.";
  if (code === "ROOM_FULL") return "Room has reached its two-peer limit.";
  return "Peer ID is already in use in this room.";
}
