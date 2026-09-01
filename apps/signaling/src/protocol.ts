export interface SignalingMessage {
  type: 'join' | 'leave' | 'offer' | 'answer' | 'candidate' | 'peer-joined' | 'peer-left';
  roomId?: string;
  peerId?: string;
  targetPeerId?: string;
  payload?: unknown;
}

export interface RoomInfo {
  roomId: string;
  peers: Map<string, import('ws').WebSocket>;
  createdAt: number;
}
