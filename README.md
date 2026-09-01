# ineVITable

ineVITable is a VIT student messaging app for private, two-person conversations. Create an account with a `@vitstudent.ac.in` address, find another student in the directory, share a room code, and connect through a WebRTC data channel.

**Live product:** [hackverse-sprint3.vercel.app](https://hackverse-sprint3.vercel.app)

## How it works

1. A student creates a room and shares its code with another student.
2. The signaling service relays only the WebRTC offer, answer, and ICE candidates needed to establish a connection.
3. After the connection opens, chat messages travel directly over the browsers' WebRTC data channel.

The app also provides account authentication, recent-presence status, and an encrypted personal message archive.

## Project structure

```text
apps/web/        React + Vite frontend and Vercel API routes
apps/signaling/  WebSocket service used for WebRTC negotiation
e2e-messaging/   Encryption and end-to-end messaging utilities
render.yaml      Render Blueprint for the signaling service
```
## Tech stack

**Frontend**
- React + Vite
- WebRTC (RTCPeerConnection + DataChannel) for direct peer-to-peer messaging

**Backend / APIs**
- Vercel serverless functions (same-origin `/api` routes)
- Node.js WebSocket service (`apps/signaling`) for WebRTC offer/answer/ICE relay

**Data & storage**
- Neon Postgres (pooled connection)
- AES-256-GCM for encrypting the message archive at rest
- bcrypt for password and session-token hashing

**Infrastructure**
- Vercel — frontend + API hosting
- Render — signaling service (via `render.yaml` Blueprint)
- STUN/TURN for NAT traversal (TURN optional, recommended for production)

## Run locally

Requirements: Node.js 20+ and npm.

Start the signaling service in one terminal:

```bash
cd apps/signaling
npm install
npm run dev
```

Start the web app in a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Configure the web app with the environment variables below. For local development, `VITE_SIGNALING_URL` should point to the browser-reachable signaling server, typically `ws://localhost:8080`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Neon Postgres connection string for the Vercel API routes. |
| `MESSAGE_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte key used to encrypt message archive rows. |
| `VITE_SIGNALING_URL` | Yes | Public WebSocket URL for the signaling service. |
| `VITE_TURN_URL` | Optional | TURN URL for networks where direct WebRTC cannot connect. |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | Optional | TURN credentials. |

Generate an archive-encryption key with:

```bash
openssl rand -base64 32
```

## Deploy

- Deploy `apps/web` to **Vercel**. It serves the Vite frontend and same-origin `/api` routes.
- Provision **Neon Postgres** and set `DATABASE_URL` plus `MESSAGE_ENCRYPTION_KEY` in Vercel.
- Deploy the root [`render.yaml`](render.yaml) Blueprint to **Render** for signaling. Set `ALLOWED_ORIGINS` to `https://hackverse-sprint3.vercel.app` (plus any preview or custom origins you need).
- Set Vercel's `VITE_SIGNALING_URL` to the Render service's public `wss://` URL, then redeploy the web app.

For production reliability, configure TURN credentials as well; STUN-only WebRTC cannot connect through every campus, mobile, or restrictive NAT/firewall network.

## Security notes

- Passwords are stored as bcrypt hashes; sessions are stored as hashes.
- Message archive content is AES-256-GCM encrypted before it is written to Postgres.
- The signaling service does not relay chat payloads after WebRTC is established.
- Room codes are bearer-style invitations. Share them only with the person you intend to chat with.

## Credits

with <3 from the Newbies team
By:
Shreyansh Misra
Sanchit Kalra
Ashwin Joseph
Vansh
