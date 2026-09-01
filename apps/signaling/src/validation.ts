import { type ClientMessage, type IceCandidate, type SessionDescription } from "./protocol.js";

const ROOM_ID = /^[A-Za-z0-9_-]{3,64}$/;
const PEER_ID = /^[A-Za-z0-9_-]{3,64}$/;
const MAX_SDP_LENGTH = 65_536;
const MAX_CANDIDATE_LENGTH = 4_096;
const MAX_CHAT_LENGTH = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value: unknown, pattern: RegExp): value is string => typeof value === "string" && pattern.test(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isNullableNumber = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);

function isDescription(value: unknown, expectedType: "offer" | "answer"): value is SessionDescription {
  return isRecord(value) && value.type === expectedType && typeof value.sdp === "string" && value.sdp.length > 0 && value.sdp.length <= MAX_SDP_LENGTH;
}

function isCandidate(value: unknown): value is IceCandidate {
  return isRecord(value) && typeof value.candidate === "string" && value.candidate.length <= MAX_CANDIDATE_LENGTH &&
    isNullableString(value.sdpMid) && isNullableNumber(value.sdpMLineIndex) &&
    (value.usernameFragment === undefined || isNullableString(value.usernameFragment));
}

/** Parses only the supported, bounded protocol shape. */
export function parseClientMessage(raw: string): ClientMessage | { error: string } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { error: "Message must be valid JSON." }; }
  if (!isRecord(value) || typeof value.type !== "string") return { error: "Message must include a supported type." };

  if (value.type === "CREATE_ROOM" || value.type === "JOIN_ROOM") {
    if (!isId(value.roomId, ROOM_ID) || !isId(value.peerId, PEER_ID)) return { error: "roomId and peerId must be 3-64 URL-safe characters." };
    return { type: value.type, roomId: value.roomId, peerId: value.peerId };
  }
  if (value.type === "SDP_OFFER" || value.type === "SDP_ANSWER") {
    if (!isId(value.roomId, ROOM_ID) || !isId(value.targetPeerId, PEER_ID) || !isDescription(value.sdp, value.type === "SDP_OFFER" ? "offer" : "answer")) {
      return { error: "Invalid SDP signaling message." };
    }
    return { type: value.type, roomId: value.roomId, targetPeerId: value.targetPeerId, sdp: value.sdp };
  }
  if (value.type === "ICE_CANDIDATE") {
    if (!isId(value.roomId, ROOM_ID) || !isId(value.targetPeerId, PEER_ID) || !isCandidate(value.candidate)) return { error: "Invalid ICE candidate message." };
    return { type: value.type, roomId: value.roomId, targetPeerId: value.targetPeerId, candidate: value.candidate };
  }
  if (value.type === "CHAT_MESSAGE") {
    if (!isId(value.roomId, ROOM_ID) || !isId(value.targetPeerId, PEER_ID) || typeof value.text !== "string" || !value.text.trim() || value.text.length > MAX_CHAT_LENGTH) return { error: "Invalid chat message." };
    return { type: value.type, roomId: value.roomId, targetPeerId: value.targetPeerId, text: value.text };
  }
  return { error: "Unsupported message type." };
}
