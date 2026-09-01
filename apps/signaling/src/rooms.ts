import type WebSocket from "ws";

export interface Peer { peerId: string; socket: WebSocket }
export interface Room { id: string; peers: Map<string, Peer> }

/** In-memory only: all state disappears when the process restarts. */
export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  constructor(private readonly maxRoomSize = 2) {}

  create(roomId: string, peer: Peer): "ok" | "ROOM_EXISTS" {
    if (this.rooms.has(roomId)) return "ROOM_EXISTS";
    this.rooms.set(roomId, { id: roomId, peers: new Map([[peer.peerId, peer]]) });
    return "ok";
  }

  join(roomId: string, peer: Peer): { result: "ok"; existing: Peer[] } | { result: "ROOM_NOT_FOUND" | "ROOM_FULL" | "PEER_EXISTS" } {
    const room = this.rooms.get(roomId);
    if (!room) return { result: "ROOM_NOT_FOUND" };
    if (room.peers.has(peer.peerId)) return { result: "PEER_EXISTS" };
    if (room.peers.size >= this.maxRoomSize) return { result: "ROOM_FULL" };
    const existing = [...room.peers.values()];
    room.peers.set(peer.peerId, peer);
    return { result: "ok", existing };
  }

  getPeer(roomId: string, peerId: string): Peer | undefined { return this.rooms.get(roomId)?.peers.get(peerId); }
  peers(roomId: string): Peer[] { return [...(this.rooms.get(roomId)?.peers.values() ?? [])]; }

  remove(roomId: string, peerId: string): Peer[] {
    const room = this.rooms.get(roomId);
    if (!room || !room.peers.delete(peerId)) return [];
    const remaining = [...room.peers.values()];
    if (remaining.length === 0) this.rooms.delete(roomId);
    return remaining;
  }

  hasPeer(roomId: string, peerId: string, socket: WebSocket): boolean {
    return this.getPeer(roomId, peerId)?.socket === socket;
  }
  size(): number { return this.rooms.size; }
}
