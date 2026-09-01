import { ConnectionManager } from "./ConnectionManager";
import { ConnectionState } from "./protocol";

function toast(msg: string, type: "info" | "success" | "error" = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function updateConnectionBadge(state: ConnectionState) {
  const badge = document.getElementById("stateBadge");
  if (!badge) return;
  badge.textContent = state;
  badge.className = `state-badge state-${state}`;
}

function updateProgressBar(p: any) {
  const track = document.getElementById("progressTrack");
  const fill = document.getElementById("progressFill");
  const stats = document.getElementById("transferStats");
  if (track) track.classList.add("active");
  if (fill) fill.style.width = `${p.percent}%`;
  if (stats)
    stats.textContent = `${p.fileName}: ${p.bytesTransferred}/${p.totalBytes} bytes (${p.percent}%) @ ${p.speedKBs.toFixed(1)} KB/s`;
}

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Downloaded: ${name}`, "success");
  appendReceived(name);
}

function appendReceived(name: string) {
  const container = document.getElementById("receivedFiles");
  if (!container) return;
  if (container.children.length === 1 && container.textContent?.includes("No files")) {
    container.innerHTML = "";
  }
  const item = document.createElement("div");
  item.style.cssText = "padding: 0.5rem 0.75rem; background: var(--bg); border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.85rem;";
  item.innerHTML = `<span style="font-weight:600;">📄 ${name}</span> <span style="color:var(--success);">received</span>`;
  container.insertBefore(item, container.firstChild);
}

function renderPeers(peers: string[]) {
  const sel = document.getElementById("targetPeer") as HTMLSelectElement;
  if (sel) {
    const current = sel.value;
    sel.replaceChildren(new Option("— Select a peer —", ""));
    peers.forEach((peerId) => sel.add(new Option(peerId, peerId)));
    if (peers.includes(current)) sel.value = current;
  }
  const list = document.getElementById("peerList");
  if (!list) return;
  list.innerHTML = "";
  if (peers.length === 0) {
    list.innerHTML = '<li style="color: var(--muted); font-size: 0.85rem;">No peers connected yet</li>';
    return;
  }
  peers.forEach((p) => {
    const li = document.createElement("li");
    li.className = "peer-item";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = p;
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = "online";
    li.append(name, status);
    list.appendChild(li);
  });
}

async function main() {
  const toastContainer = document.createElement("div");
  toastContainer.id = "toastContainer";
  document.body.appendChild(toastContainer);

  const peerIdInput = document.getElementById("peerIdInput") as HTMLInputElement;
  const signalingUrl = document.getElementById("signalingUrl") as HTMLInputElement;
  const connectBtn = document.getElementById("connectBtn") as HTMLButtonElement;
  const disconnectBtn = document.getElementById("disconnectBtn") as HTMLButtonElement;
  const fileInput = document.getElementById("fileInput") as HTMLInputElement;
  const fileLabel = document.getElementById("fileLabel") as HTMLDivElement;

  if (!peerIdInput.value) peerIdInput.value = "user-" + Math.floor(Math.random() * 10000);
  // The app and signaling server are served together. This keeps remote LAN
  // clients from accidentally signaling to their own localhost instance.
  signalingUrl.value = window.location.origin;

  let manager: ConnectionManager | null = null;
  let selectedPeerId: string | null = null;

  connectBtn.addEventListener("click", async () => {
    const url = signalingUrl.value.trim() || window.location.origin;
    const peerId = peerIdInput.value.trim() || `user-${Math.floor(Math.random() * 10000)}`;
    if (manager) return;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(peerId)) {
      toast("Peer ID must be 1–64 letters, numbers, _ or -", "error");
      return;
    }

    manager = new ConnectionManager({
      signalingUrl: url,
      peerId: peerId,
      onStateChange: (state) => {
        updateConnectionBadge(state);
        if (state === "connected") {
          connectBtn.disabled = true;
          disconnectBtn.disabled = false;
          fileLabel?.classList.remove("disabled");
          fileInput.disabled = false;
          toast("Connection established!", "success");
        } else if (state === "closed" || state === "failed") {
          connectBtn.disabled = false;
          disconnectBtn.disabled = true;
          fileLabel?.classList.add("disabled");
          fileInput.disabled = true;
        } else if (state === "connecting") {
          connectBtn.disabled = true;
          connectBtn.textContent = "Connecting...";
        } else if (state === "signaling") {
          connectBtn.disabled = true;
          disconnectBtn.disabled = false;
          connectBtn.textContent = "Joined LAN";
        } else {
          connectBtn.textContent = "Connect";
        }
      },
      onDataChannelReady: (dc) => {
        dc.onProgress = (p) => updateProgressBar(p);
        dc.onFileComplete = (name, blob) => triggerDownload(name, blob);
        dc.onOpen = () => toast("Data channel open — negotiating encryption", "info");
        dc.onSecureReady = () => toast("AES-GCM channel ready — select a file", "success");
      },
      onPeersChanged: renderPeers,
    });

    try {
      await manager.start();
    } catch (error) {
      manager = null;
      connectBtn.disabled = false;
      connectBtn.textContent = "Join LAN";
      toast(`Could not join signaling: ${(error as Error).message}`, "error");
      return;
    }
    toast("Signaling connected — select a peer and connect", "info");
  });

  disconnectBtn.addEventListener("click", () => {
    manager?.disconnect();
    manager = null;
    toast("Disconnected from signaling", "info");
  });

  document.getElementById("targetPeer")?.addEventListener("change", (e) => {
    selectedPeerId = (e.target as HTMLSelectElement).value || null;
    if (selectedPeerId) {
      connectBtn.textContent = `Connect to ${selectedPeerId}`;
      manager?.connectToPeer(selectedPeerId);
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !manager) return;
    const dc = manager.getDataChannel();
    if (!dc) {
      toast("No data channel open — connect first", "error");
      return;
    }
    toast(`Sending: ${file.name}`, "info");
    try {
      await dc.sendFile(file, crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));
    } catch (error) {
      toast(`Transfer failed: ${(error as Error).message}`, "error");
    }
  });
}

main();
