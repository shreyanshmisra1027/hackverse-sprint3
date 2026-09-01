// src/network/protocol.ts

export type SignalingMessageType =
  | "join"
  | "peer-list"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "peer-left"
  | "error";

export interface SignalingMessage {
  type: SignalingMessageType;
  from?: string;
  to?: string;
  payload?: any;
}

export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

// Connection lifecycle states exposed to the UI
export type ConnectionState =
  | "idle"
  | "signaling"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

// DataChannel chunk framing — every chunk gets a tiny JSON header
// followed by the raw ArrayBuffer, sent as two separate channel.send() calls
export interface ChunkHeader {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
}

export const CHUNK_SIZE = 16 * 1024; // 16KB — safe under the ~256KB SCTP message cap
export const BACKPRESSURE_HIGH_WATER = 8 * CHUNK_SIZE; // pause sending above this
export const BACKPRESSURE_LOW_WATER = 2 * CHUNK_SIZE;  // resume below this
export const CONNECTION_TIMEOUT_MS = 15_000;
export const RECONNECT_MAX_ATTEMPTS = 3;
export const RECONNECT_BACKOFF_MS = 1500;
