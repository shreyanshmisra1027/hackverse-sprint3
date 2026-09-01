import { useRef, useState } from "react";
import type { ReceivedFile } from "../types";

export function FileShare({ onSend, received, disabled }: { onSend: (file: File) => Promise<void>; received: ReceivedFile[]; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const send = async (file?: File) => {
    if (!file || disabled || sending) return;
    setSending(true);
    try { await onSend(file); } finally { setSending(false); if (input.current) input.current.value = ""; }
  };
  return <section className="panel files">
    <h2>Files</h2>
    <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void send(event.dataTransfer.files[0]); }}>
      <p>Drop a small file here, or</p>
      <button type="button" onClick={() => input.current?.click()} disabled={disabled || sending}>{sending ? "Sending…" : "Choose a file"}</button>
      <input ref={input} type="file" hidden onChange={(event) => void send(event.target.files?.[0])} />
    </div>
    {received.length > 0 && <div className="received"><h3>Received</h3>{received.map((file) => <a key={file.id} href={file.url} download={file.name}>{file.name} <small>({Math.ceil(file.size / 1024)} KB)</small></a>)}</div>}
  </section>;
}
