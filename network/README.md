# ineVITable — Secure LAN File Transfer

Browser-to-browser file transfer for a shared LAN. The Node.js server performs
only peer discovery and WebRTC signaling; file bytes travel directly between
browsers over an RTCDataChannel.

## What is implemented

- Real peer discovery through a local Socket.IO signaling node.
- Direct, ordered WebRTC data-channel transfer with chunking and backpressure.
- LAN-first ICE configuration: no public STUN server is configured by default.
- WebRTC DTLS transport encryption plus, in HTTPS/localhost contexts, a
  per-data-channel Web Crypto layer:
  ephemeral ECDH P-256 derives an AES-256-GCM key that encrypts each file
  chunk and its metadata.
- Server-side peer-ID validation, duplicate-ID prevention, and safe static-file
  paths.

## What deployment must provide

The demo does **not** verify `@vitstudent.ac.in` identities. A text field in a
browser is not authentication. Before making that claim in production, connect
the `join` flow to VIT's approved SSO/OIDC service and derive the peer identity
on the server from the validated token. Do not add a client-only email check.

ECDH public keys are exchanged over the data channel when Web Crypto is
available. A plain-HTTP LAN demo uses WebRTC's built-in DTLS encryption only;
production should serve the app over HTTPS to enable the additional AES-GCM
layer and bind key fingerprints to authenticated users.

## Run on the LAN

Use one operating system environment per checkout. If you use WSL, run all
commands below in WSL; do not reuse `node_modules` installed by Windows.

```bash
npm install
npm run build
npm start
```

On each client, browse to `http://<server-LAN-IP>:3000`, enter a unique peer
ID, click **Join LAN**, select the other discovered peer, and send a file. The
client defaults its signaling URL to the address that served the page, so LAN
clients do not need to enter the server IP manually.

## Repository conventions

- Commit: source, `package.json`, and `package-lock.json`.
- Do not commit: `node_modules/` or generated `public/app-bundle.js`.
- Run `npm run check` and follow [TESTING.md](TESTING.md) before opening a PR.

## Architecture

```text
Browser A ── Socket.IO signaling ── Local Node.js server ── Socket.IO signaling ── Browser B
    └──────────────────── encrypted WebRTC data channel ────────────────────┘
```

The signaling server never receives file content.
