import { useEffect, useRef, useState } from "react";
import { base64ToBytes, createRoomKey, decryptJson, encryptJson, exportRoomKey, importRoomKey, bytesToBase64 } from "./crypto";
import { SignalingClient } from "./signaling";
import type { ChatMessage, PlainPayload, ReceivedFile, Role, SignalInbound } from "./types";
import { WebRtcPeer } from "./webrtc";
import { RoomEntry } from "./components/RoomEntry";
import { ChatWindow } from "./components/ChatWindow";
import { FileShare } from "./components/FileShare";

const signalingUrl = import.meta.env.VITE_SIGNALING_URL as string | undefined;
const fileChunkSize = 16 * 1024;
const id = () => crypto.randomUUID();
const roomCode = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10);
type PendingFile = { name: string; mime: string; size: number; chunks: string[]; expectedChunks: number };

export default function App() {
  const [roomId, setRoomId] = useState<string>();
  const [role, setRole] = useState<Role>();
  const [status, setStatus] = useState("Ready to connect");
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [received, setReceived] = useState<ReceivedFile[]>([]);
  const signal = useRef<SignalingClient | null>(null);
  const rtc = useRef<WebRtcPeer | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const key = useRef<CryptoKey | null>(null);
  const ownPeerId = useRef(`peer_${id().replaceAll("-", "").slice(0, 18)}`);
  const remotePeerId = useRef<string | null>(null);
  const pendingFiles = useRef(new Map<string, PendingFile>());

  useEffect(() => () => { channel.current?.close(); rtc.current?.close(); signal.current?.close(); }, []);

  const transmit = async (payload: PlainPayload) => {
    if (!key.current || channel.current?.readyState !== "open") throw new Error("Encrypted connection is not ready.");
    channel.current.send(JSON.stringify({ type: "encrypted", payload: await encryptJson(key.current, payload) }));
  };

  const handlePayload = (payload: PlainPayload) => {
    if (payload.type === "chat") setMessages((items) => [...items, { id: payload.id, author: "peer", text: payload.text, time: payload.sentAt }]);
    if (payload.type === "file-start") pendingFiles.current.set(payload.id, { name: payload.name, mime: payload.mime, size: payload.size, expectedChunks: payload.chunks, chunks: [] });
    if (payload.type === "file-chunk") pendingFiles.current.get(payload.id)?.chunks.splice(payload.index, 0, payload.data);
    if (payload.type === "file-end") {
      const file = pendingFiles.current.get(payload.id);
      if (!file || file.chunks.length !== file.expectedChunks) return;
      const parts: BlobPart[] = file.chunks.map((chunk) => {
        const bytes = base64ToBytes(chunk);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      });
      const blob = new Blob(parts, { type: file.mime || "application/octet-stream" });
      pendingFiles.current.delete(payload.id);
      setReceived((items) => [...items, { id: payload.id, name: file.name, mime: file.mime, size: file.size, url: URL.createObjectURL(blob) }]);
    }
  };

  const attachChannel = (dataChannel: RTCDataChannel, isCreator: boolean) => {
    channel.current = dataChannel;
    dataChannel.addEventListener("open", () => {
      setStatus("Direct connection established; securing channel…");
      if (isCreator) void (async () => {
        const roomKey = await createRoomKey(); key.current = roomKey;
        dataChannel.send(JSON.stringify({ type: "room-key", key: await exportRoomKey(roomKey) }));
        setReady(true); setStatus("Encrypted direct connection ready");
      })().catch(() => setError("Could not initialize encrypted messaging."));
    });
    dataChannel.addEventListener("close", () => { setReady(false); setStatus("Direct connection closed"); });
    dataChannel.addEventListener("message", ({ data }) => void (async () => {
      if (typeof data !== "string") return;
      try {
        const envelope = JSON.parse(data) as { type: string; key?: string; payload?: string };
        if (envelope.type === "room-key" && envelope.key && !isCreator) {
          key.current = await importRoomKey(envelope.key); setReady(true); setStatus("Encrypted direct connection ready"); return;
        }
        if (envelope.type === "encrypted" && envelope.payload && key.current) handlePayload(await decryptJson<PlainPayload>(key.current, envelope.payload));
      } catch { setError("Received an unreadable encrypted payload."); }
    })());
  };

  const enterRoom = async (newRoomId: string, newRole: Role) => {
    if (!signalingUrl) { setError("VITE_SIGNALING_URL is not configured."); return; }
    setError(undefined); setStatus("Connecting to signaling service…"); setRoomId(newRoomId); setRole(newRole);
    const client = new SignalingClient(signalingUrl, {
      onError: setError,
      onClose: () => setStatus("Signaling connection closed"),
      onMessage: (message) => void handleSignal(message, newRoomId, newRole),
    });
    signal.current = client;
    try { await client.connect(); client.send({ type: newRole === "creator" ? "CREATE_ROOM" : "JOIN_ROOM", roomId: newRoomId, peerId: ownPeerId.current }); setStatus(newRole === "creator" ? "Room created — share the code" : "Joined room — waiting for peer"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect."); setRoomId(undefined); }
  };

  const handleSignal = async (message: SignalInbound, activeRoomId: string, activeRole: Role) => {
    if (message.type === "PEER_JOINED") {
      if (message.peerId === ownPeerId.current) return;
      remotePeerId.current = message.peerId; setStatus("Peer found — negotiating direct connection…");
      if (activeRole === "creator" && !rtc.current) createPeer(activeRoomId, activeRole).initiate(message.peerId).catch(() => setError("Could not create WebRTC offer."));
      return;
    }
    if (message.type === "PEER_LEFT") { setReady(false); setStatus("Peer left the room"); return; }
    if (message.type === "SDP_OFFER" || message.type === "SDP_ANSWER" || message.type === "ICE_CANDIDATE") {
      const peer = rtc.current ?? createPeer(activeRoomId, activeRole);
      const remote = remotePeerId.current;
      if (remote) await peer.handle(message, remote);
    }
  };

  const createPeer = (activeRoomId: string, activeRole: Role) => {
    const peer = new WebRtcPeer(activeRoomId, {
      onState: (state) => setStatus(state === "connected" ? "Direct connection established" : `Connection: ${state}`),
      onChannel: (dataChannel) => attachChannel(dataChannel, activeRole === "creator"),
      onSignal: (message) => { try { signal.current?.send(message); } catch { setError("Signaling connection was lost."); } },
    });
    rtc.current = peer; return peer;
  };

  const sendText = (text: string) => { const message = { id: id(), author: "me" as const, text, time: Date.now() }; setMessages((items) => [...items, message]); void transmit({ type: "chat", id: message.id, text, sentAt: message.time }).catch(() => setError("Message could not be sent.")); };
  const sendFile = async (file: File) => {
    const fileId = id(); const chunks = Math.ceil(file.size / fileChunkSize);
    await transmit({ type: "file-start", id: fileId, name: file.name, mime: file.type, size: file.size, chunks });
    for (let index = 0; index < chunks; index += 1) await transmit({ type: "file-chunk", id: fileId, index, data: bytesToBase64(new Uint8Array(await file.slice(index * fileChunkSize, Math.min((index + 1) * fileChunkSize, file.size)).arrayBuffer())) });
    await transmit({ type: "file-end", id: fileId });
  };

  if (!roomId) return <RoomEntry busy={status.startsWith("Connecting")} error={error} onCreate={() => enterRoom(roomCode(), "creator")} onJoin={(code) => enterRoom(code, "joiner")} />;
  return <main className="app-shell"><header><div><p className="eyebrow">Room code</p><h1>{roomId}</h1></div><button className="copy" onClick={() => void navigator.clipboard.writeText(roomId)}>Copy code</button></header><p className={`status ${error ? "error" : ""}`}>{error || status}</p><p className="hint">{role === "creator" && !remotePeerId.current ? "Share this room code with one person." : ready ? "Messages and files are encrypted before they leave this browser." : "Waiting for peer connection."}</p><div className="workspace"><ChatWindow messages={messages} onSend={sendText} disabled={!ready} /><FileShare onSend={sendFile} received={received} disabled={!ready} /></div></main>;
}
