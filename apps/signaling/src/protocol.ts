export const CLIENT_MESSAGE_TYPES = [
  "CREATE_ROOM", "JOIN_ROOM", "SDP_OFFER", "SDP_ANSWER", "ICE_CANDIDATE",
] as const;

export type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[number];
export type ServerMessageType = "PEER_JOINED" | "PEER_LEFT" | "ERROR";

export interface CreateRoomMessage { type: "CREATE_ROOM"; roomId: string; peerId: string }
export interface JoinRoomMessage { type: "JOIN_ROOM"; roomId: string; peerId: string }
export interface SessionDescription {
  type: "offer" | "answer";
  sdp: string;
}
export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}
export interface SignalMessage {
  type: "SDP_OFFER" | "SDP_ANSWER" | "ICE_CANDIDATE";
  roomId: string;
  targetPeerId: string;
  sdp?: SessionDescription;
  candidate?: IceCandidate;
}
export type ClientMessage = CreateRoomMessage | JoinRoomMessage | SignalMessage;

export type ServerMessage =
  | { type: "PEER_JOINED"; roomId: string; peerId: string }
  | { type: "PEER_LEFT"; roomId: string; peerId: string }
  | { type: "ERROR"; code: string; message: string };

export const errorMessage = (code: string, message: string): ServerMessage => ({
  type: "ERROR", code, message,
});
