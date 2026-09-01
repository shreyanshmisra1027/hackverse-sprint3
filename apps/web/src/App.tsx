import { useEffect, useRef, useState } from "react";
import { SignalingClient, type SignalingStatus } from "./signaling";

export default function App() {
  const [status, setStatus] = useState<SignalingStatus>("idle");
  const [detail, setDetail] = useState("Not connected");
  const client = useRef<SignalingClient | null>(null);

  useEffect(() => () => client.current?.close(), []);

  const connect = () => {
    client.current ??= new SignalingClient({
      onStatus: (nextStatus, nextDetail) => {
        setStatus(nextStatus);
        setDetail(nextDetail ?? nextStatus);
      },
    });
    client.current.connect();
  };

  return <main>
    <h1>ineVITable</h1>
    <p>A peer-to-peer messaging app.</p>
    <button onClick={connect} disabled={status === "connecting" || status === "connected"}>Connect</button>
    <p role="status">Signaling: <strong>{detail}</strong></p>
  </main>;
}
