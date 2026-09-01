# ineVITable

Peer-to-peer communication, in the browser.

# What this is

A web app for direct P2P communication between clients — no central server relaying messages/media once a connection is established.

## Project structure

```
apps/web/        Vite browser client and WebRTC data-channel chat
apps/signaling/  WebRTC negotiation WebSocket service
render.yaml      Render Blueprint for the signaling service
```

## Run locally

Run the signaling service in one terminal:

```bash
cd apps/signaling
npm install
npm run dev
```

Run the frontend in another terminal:

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

`VITE_SIGNALING_URL` must point to the browser-reachable WebSocket
address of the signaling service (`ws://localhost:10000` by default). In
production use its public `wss://` address and set `ALLOWED_ORIGINS` on the
signaling service to the exact frontend origin.

The dashboard creates an ephemeral room code. One browser creates the room and
shares that code; a second browser joins it. The server relays only WebRTC
negotiation frames. Once connected, chat messages travel through the browsers'
WebRTC data channel and are not stored by the service.

## Deploy on Render

1. Push the `main` branch to GitHub.
2. In Render, choose **New → Blueprint** and select this repository.
3. Keep the default Blueprint Path, `render.yaml`.
4. Enter `ALLOWED_ORIGINS` as the exact browser origin or origins allowed to
   open a WebSocket connection (for example, `https://example.com`).
5. Deploy, then verify `https://<service-name>.onrender.com/health` returns
   `{"status":"ok"}`.

Render supplies `PORT`; do not configure it manually. The service is an
in-memory two-peer signaling relay, so no database, disk, or other external
service is required.
