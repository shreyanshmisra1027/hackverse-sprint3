export type Role = "creator" | "joiner";

export type SignalOutbound =
  | { type: "CREATE_ROOM"; roomId: string; peerId: string }
  | { type: "JOIN_ROOM"; roomId: string; peerId: string }
  | { type: "SDP_OFFER" | "SDP_ANSWER"; roomId: string; targetPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ICE_CANDIDATE"; roomId: string; targetPeerId: string; candidate: RTCIceCandidateInit };

export type SignalInbound =
  | { type: "PEER_JOINED"; roomId: string; peerId: string }
  | { type: "PEER_LEFT"; roomId: string; peerId: string }
  | { type: "SDP_OFFER" | "SDP_ANSWER"; roomId: string; targetPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ICE_CANDIDATE"; roomId: string; targetPeerId: string; candidate: RTCIceCandidateInit }
  | { type: "ERROR"; code: string; message: string };

export type ChatMessage = { id: string; author: "me" | "peer"; text: string; time: number };
export type ReceivedFile = { id: string; name: string; mime: string; url: string; size: number };

export type PlainPayload =
  | { type: "chat"; id: string; text: string; sentAt: number }
  | { type: "file-start"; id: string; name: string; mime: string; size: number; chunks: number }
  | { type: "file-chunk"; id: string; index: number; data: string }
  | { type: "file-end"; id: string };
