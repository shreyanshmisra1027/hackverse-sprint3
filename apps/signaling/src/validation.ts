export const VALID_MESSAGE_TYPES = [
  'join',
  'leave',
  'offer',
  'answer',
  'candidate',
  'peer-joined',
  'peer-left',
] as const;

export type MessageType = typeof VALID_MESSAGE_TYPES[number];

export const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB
export const MAX_ROOM_ID_LENGTH = 64;
export const MAX_PEER_ID_LENGTH = 64;
export const MAX_PEERS_PER_ROOM = 50;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function validateMessage(data: unknown): ValidationResult {
  if (data === null || typeof data !== 'object') {
    return { valid: false, error: 'Message must be a JSON object' };
  }

  const msg = data as Record<string, unknown>;

  // Validate type
  if (!isString(msg.type)) {
    return { valid: false, error: 'Missing or invalid message type' };
  }

  if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(msg.type)) {
    return { valid: false, error: `Invalid message type: ${msg.type}` };
  }

  // Validate roomId for relevant types
  const needsRoom = ['join', 'leave', 'offer', 'answer', 'candidate', 'peer-joined', 'peer-left'];
  if (needsRoom.includes(msg.type)) {
    if (!isString(msg.roomId)) {
      return { valid: false, error: 'Missing roomId' };
    }
    if (msg.roomId.length > MAX_ROOM_ID_LENGTH) {
      return { valid: false, error: `roomId exceeds max length (${MAX_ROOM_ID_LENGTH})` };
    }
  }

  // Validate peerId for relevant types
  const needsPeer = ['join', 'leave', 'offer', 'answer', 'candidate', 'peer-joined', 'peer-left'];
  if (needsPeer.includes(msg.type)) {
    if (!isString(msg.peerId)) {
      return { valid: false, error: 'Missing peerId' };
    }
    if (msg.peerId.length > MAX_PEER_ID_LENGTH) {
      return { valid: false, error: `peerId exceeds max length (${MAX_PEER_ID_LENGTH})` };
    }
  }

  // Validate payload for offer/answer/candidate
  if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'candidate') {
    if (msg.payload === undefined) {
      return { valid: false, error: 'Missing payload for signaling message' };
    }
  }

  // Size check (approximate by JSON string length if needed externally)
  return { valid: true };
}
