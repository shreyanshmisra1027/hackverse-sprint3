# ineVITable web app

A static Vite + React browser client for the two-person WebRTC signaling service.
It uses the signaling server only for SDP and ICE setup; chat messages and files
move over an `RTCDataChannel` directly between the browsers.

## Run locally

Requires Node 20+.

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

`VITE_SIGNALING_URL` is required and must be a public `wss://` URL. It is read
only from Vite environment configuration, never hard-coded in application source.
For local development, add `http://localhost:5173` to the signaling service's
`ALLOWED_ORIGINS` configuration.

## How it works

1. The room creator generates a room code and both peers send that code plus a
   locally generated peer ID to the signaling service.
2. When both peers have joined, the creator offers a WebRTC data channel. SDP
   and ICE candidates are forwarded through the signaling service.
3. The creator generates one AES-256-GCM key and sends it on the open direct
   data channel. Chat payloads and 16 KB file chunks are encrypted before they
   are sent; received chunks are decrypted and reassembled into a download.

The app uses `stun:stun.l.google.com:19302` for the MVP. A TURN service is
needed for many restrictive NAT/firewall combinations and is intentionally out
of scope here.

## Important security limitation

The current AES key transfer is a deliberately isolated MVP placeholder in
`src/crypto.ts`. Sending a symmetric key through the data channel does **not**
provide authenticated key exchange or protection from a signaling-path MITM.
Replace it with authenticated ECDH (and verify peer identity) before production.
Do not treat this app as production-grade secure messaging.

## Deploy as a static site

Build locally with:

```bash
npm run build
```

The output directory is `dist/`. For Cloudflare Pages or Vercel:

- Set the build command to `npm run build`.
- Set the output directory to `dist`.
- Add `VITE_SIGNALING_URL=wss://p2p-signaling.onrender.com` in the hosting
  dashboard's build environment (or your team’s current signaling URL).
- After deployment, add the exact frontend origin, such as
  `https://your-app.pages.dev`, to the signaling server's `ALLOWED_ORIGINS` on
  Render, then redeploy that service.

Rooms are capped at two peers. There is no user authentication, persistence,
message history, delivery retry, or TURN fallback in this MVP. Keep files small:
the app intentionally sends one encrypted 16 KB chunk at a time.
