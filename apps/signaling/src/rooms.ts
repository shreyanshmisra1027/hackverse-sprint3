import { RoomInfo } from './protocol';
import { WebSocket } from 'ws';

export class RoomStore {
  private rooms = new Map<string, RoomInfo>();
  private readonly maxPeers = 50;

  createRoom(roomId: string): RoomInfo {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }
    const room: RoomInfo = {
      roomId,
      peers: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  addPeer(roomId: string, peerId: string, ws: WebSocket): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;
    if (room.peers.size >= this.maxPeers) return false;
    room.peers.set(peerId, ws);
    return true;
  }

  removePeer(roomId: string, peerId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const removed = room.peers.delete(peerId);
    if (room.peers.size === 0) {
      this.deleteRoom(roomId);
    }
    return removed;
  }

  getPeers(roomId: string): string[] {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return Array.from(room.peers.keys());
  }

  getPeerCount(roomId: string): number {
    const room = this.getRoom(roomId);
    return room ? room.peers.size : 0;
  }

  getAllRooms(): Map<string, RoomInfo> {
    return this.rooms;
  }

  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.peers.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}

export const roomStore = new RoomStore();
