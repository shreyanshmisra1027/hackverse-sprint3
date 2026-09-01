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

`VITE_SIGNALING_URL` must point to the browser-reachable WebSocket address of
the signaling service (`ws://localhost:10000` by default). In production use
its public `wss://` address and set `ALLOWED_ORIGINS` on the signaling service
to the exact frontend origin.

The dashboard creates an ephemeral room code. One browser creates the room and
shares that code; a second browser joins it. The server relays only WebRTC
negotiation frames. Once connected, chat messages travel through the browsers'
WebRTC data channel and are not stored by the service.

## Production deployment

This project has three deployed parts:

- **Vercel** hosts the Vite site and its `/api` serverless functions.
- **Neon Lakebase Postgres** stores bcrypt password hashes, hashed session
  tokens, and AES-256-GCM encrypted message archives.
- **Render** hosts only WebRTC signaling. Message payloads still travel over
  the browser WebRTC data channel after negotiation; Render does not store
  them.

### 1. Neon and Vercel

Create a Neon project and use its **pooled** `DATABASE_URL` in Vercel. Add
these environment variables to Vercel for Production, Preview, and Development:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (`...-pooler...`) |
| `MESSAGE_ENCRYPTION_KEY` | Base64-encoded, random 32-byte key |
| `VITE_SIGNALING_URL` | `wss://<render-service>.onrender.com` |

Generate the encryption key locally with `openssl rand -base64 32`; keep it
only in Vercel's encrypted environment settings. It encrypts archive rows
before they reach Neon. Passwords are never saved in the browser or database
as plaintext: they are bcrypt hashes. There is intentionally no email/OTP
verification flow.

Import the repository into Vercel and set the **Root Directory** to `apps/web`.
Vercel installs dependencies, builds the Vite client, and deploys the `api/`
functions automatically. Do not set `VITE_API_URL` in Vercel: it would make the
browser bypass the same-origin functions.

### 2. Render signaling

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

Set `ALLOWED_ORIGINS` to the exact Vercel production URL (and any custom domain),
for example `https://inevitable.vercel.app`. After its first deploy, copy the
Render service URL into Vercel as `VITE_SIGNALING_URL`, redeploy Vercel, then
update Render's allowlist if the final Vercel domain differs.
