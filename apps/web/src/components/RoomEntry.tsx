import { useState } from "react";

type Props = { onCreate: () => Promise<void>; onJoin: (roomId: string) => Promise<void>; busy: boolean; error?: string };

export function RoomEntry({ onCreate, onJoin, busy, error }: Props) {
  const [roomId, setRoomId] = useState("");
  return <main className="entry-card">
    <p className="eyebrow">ineVITable</p>
    <h1>Private browser-to-browser sharing.</h1>
    <p>Messages and files travel over a direct WebRTC connection after setup.</p>
    <button onClick={() => void onCreate()} disabled={busy}>Create room</button>
    <div className="divider">or join a room</div>
    <form onSubmit={(event) => { event.preventDefault(); if (roomId.trim()) void onJoin(roomId.trim()); }}>
      <label htmlFor="room-code">Room code</label>
      <input id="room-code" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Paste a room code" minLength={3} maxLength={64} required />
      <button type="submit" disabled={busy}>Join room</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}
