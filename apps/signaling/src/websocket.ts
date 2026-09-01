import { WebSocket } from 'ws';
import { validateMessage } from './validation';
import { roomStore } from './rooms';
import { SignalingMessage } from './protocol';

export function handleMessage(ws: WebSocket, msg: unknown) {
  const validation = validateMessage(msg);
  if (!validation.valid) {
    ws.send(JSON.stringify({ type: 'error', message: validation.error || 'Invalid message' }));
    return;
  }

  const m = msg as SignalingMessage;
  const { type, roomId, peerId, targetPeerId, payload } = m;

  switch (type) {
    case 'join': {
      if (!roomId || !peerId) return;
      roomStore.createRoom(roomId);
      const added = roomStore.addPeer(roomId, peerId, ws);
      if (!added) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room full or invalid' }));
        return;
      }
      const room = roomStore.getRoom(roomId);
      if (!room) return;
      const peers = Array.from(room.peers.keys());

      peers.forEach(pid => {
        if (pid !== peerId) {
          const targetWs = room.peers.get(pid);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'peer-joined',
              roomId,
              peerId,
              payload: { peerId },
            }));
          }
        }
      });

      const existing = peers.filter(p => p !== peerId);
      ws.send(JSON.stringify({
        type: 'joined',
        roomId,
        peerId,
        payload: { peers: existing },
      }));
      break;
    }

    case 'leave': {
      if (!roomId || !peerId) return;
      roomStore.removePeer(roomId, peerId);
      const room = roomStore.getRoom(roomId);
      if (room) {
        const peers = Array.from(room.peers.keys());
        peers.forEach(pid => {
          const targetWs = room.peers.get(pid);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'peer-left',
              roomId,
              peerId,
              payload: { peerId },
            }));
          }
        });
      }
      break;
    }

    case 'offer':
    case 'answer':
    case 'candidate': {
      if (!roomId || !peerId || !targetPeerId || payload === undefined) return;
      const room = roomStore.getRoom(roomId);
      if (!room) return;
      const targetWs = room.peers.get(targetPeerId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
          type,
          roomId,
          peerId,
          targetPeerId,
          payload,
        }));
      }
      break;
    }

    default:
      break;
  }
}

export function handleDisconnect(ws: WebSocket) {
  for (const [roomId, room] of roomStore.getAllRooms().entries()) {
    for (const [peerId, socket] of room.peers.entries()) {
      if (socket === ws) {
        roomStore.removePeer(roomId, peerId);
        const remaining = roomStore.getRoom(roomId);
        if (remaining) {
          const peers = Array.from(remaining.peers.keys());
          peers.forEach(pid => {
            const targetWs = remaining.peers.get(pid);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'peer-left',
                roomId,
                peerId,
                payload: { peerId },
              }));
            }
          });
        }
        return;
      }
    }
  }
}
