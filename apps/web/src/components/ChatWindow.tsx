import { useState } from "react";
import type { ChatMessage } from "../types";

export function ChatWindow({ messages, onSend, disabled }: { messages: ChatMessage[]; onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim()); setText("");
  };
  return <section className="panel chat">
    <h2>Messages</h2>
    <div className="thread" aria-live="polite">
      {messages.length === 0 && <p className="muted">No messages yet.</p>}
      {messages.map((message) => <div className={`message ${message.author}`} key={message.id}><span>{message.text}</span><time>{new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>)}
    </div>
    <form className="composer" onSubmit={submit}>
      <input aria-label="Message" value={text} onChange={(event) => setText(event.target.value)} placeholder={disabled ? "Waiting for encrypted connection…" : "Write a message"} disabled={disabled} maxLength={4000} />
      <button type="submit" disabled={disabled || !text.trim()}>Send</button>
    </form>
  </section>;
}
