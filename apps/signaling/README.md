# Signaling service

This is an ephemeral, in-memory WebRTC signaling service. It only relays validated SDP and ICE negotiation data between the two members of a room. Chat messages, files, and keys must travel over the WebRTC data channel and are never stored or inspected here.

## Local setup

Requires Node.js 20+.

```bash
cd apps/signaling
cp .env.example .env
npm install
npm run build
npm start
```

The health check is `GET http://localhost:8080/health`, returning `{"status":"ok"}`. The browser WebSocket URL is `ws://localhost:8080` locally and should be `wss://your-signaling-host` in production. Set it in the frontend's deployment environment; do not point the frontend at an internal container hostname.

The compiled entry point is `dist/src/index.js`; `npm start` runs that file automatically.

Run the integration tests with `npm test`. They start two WebSocket clients and cover creation, joining, SDP/ICE forwarding, invalid messages, full rooms, and disconnect notification.

## Protocol

All frames are UTF-8 JSON. IDs use 3–64 URL-safe characters (`A-Z`, `a-z`, `0-9`, `_`, `-`). A socket may belong to exactly one two-peer room.

Client to server:

| Type | Required fields |
| --- | --- |
| `CREATE_ROOM` | `roomId`, `peerId` |
| `JOIN_ROOM` | `roomId`, `peerId` |
| `SDP_OFFER` | `roomId`, `targetPeerId`, `sdp: { type: "offer", sdp }` |
| `SDP_ANSWER` | `roomId`, `targetPeerId`, `sdp: { type: "answer", sdp }` |
| `ICE_CANDIDATE` | `roomId`, `targetPeerId`, `candidate` |

Server to client: `PEER_JOINED`, `PEER_LEFT`, and `ERROR`. SDP and ICE frames are accepted only from a peer currently in the stated room and only relayed to the named peer in that same room. Empty rooms are deleted on disconnect; process restart drops all rooms.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP/WebSocket listening port |
| `ALLOWED_ORIGINS` | unset | Comma-separated exact browser origins. Set in production. |
| `MAX_CONNECTIONS` | `500` | Process-level WebSocket cap |
| `MAX_PAYLOAD_BYTES` | `70000` | Maximum WebSocket frame payload |
| `MAX_MESSAGES_PER_WINDOW` | `40` | Per-socket rate limit |
| `RATE_WINDOW_MS` | `10000` | Rate-limit window |
| `STUN_URLS`, `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | unset | Optional values the deployment/frontend may expose to configure `RTCPeerConnection`; the signaling process does not consume them. |

`ALLOWED_ORIGINS` deliberately permits all browser origins when omitted to make a local demo easy. Production must set an exact allowlist, such as `https://app.example.com,https://project.pages.dev`. Non-browser tools without an `Origin` header can connect for operational testing.

## Security and limits

The service validates frame types and fields rather than forwarding arbitrary JSON; rejects binary frames; bounds IDs, SDP, candidates, and WebSocket frames; limits connections and per-socket message rate; and cleans room state on close. It intentionally logs only its listening port—not offer/answer/candidate data, plaintext, files, or keys. Use TLS (`wss`) in production. This is basic abuse resistance, not an authentication or authorization system: anyone who learns a room ID can attempt to join it before the intended peer.

## Docker

```bash
docker build -t p2p-signaling apps/signaling
docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=https://your-app.pages.dev p2p-signaling
```

The image uses a multi-stage Node 20 Alpine build and runs as the unprivileged `node` user.

## Zero-cost deployment

Recommended team choice: deploy the future static frontend to **Vercel** and this Docker service to **Render's Free web-service tier**. Vercel should host static frontend assets only; the persistent signaling socket belongs on Render. Configure the service health check as `/health`, its `PORT` as supplied by the host, `ALLOWED_ORIGINS` to the Vercel/custom-domain origins, and the frontend's public `wss://...` signaling URL.

Free tiers change and commonly sleep inactive services, impose connection/runtime limits, or have no uptime SLA; verify the provider's current terms before submission. The service has no database, storage, paid API, or authentication dependency. For a live demo, a sleeping host may need a first request to wake it.

### Render setup for this repository

The root-level `render.yaml` is a Render Blueprint. It explicitly sets the
Dockerfile and Docker build context to `apps/signaling`, so they resolve
correctly in the monorepo. After the repository is pushed to GitHub, GitLab, or Bitbucket:

1. In Render, choose **New → Blueprint** and select the repository. Leave the Blueprint Path as the default, `render.yaml`.
2. Select the Free plan and deploy. Render provides `PORT` automatically; do not override it.
3. Enter `ALLOWED_ORIGINS` when prompted. Until a frontend exists, use a local development origin such as `http://localhost:5173`; later replace/add the exact deployed frontend origin.
4. Wait for `https://<service-name>.onrender.com/health` to return `{"status":"ok"}`.
5. Configure the frontend's public variable to `wss://<service-name>.onrender.com`—never `ws://` for the public deployment.

This server keeps rooms only in process memory, which exactly fits the two-peer demo but means all current rooms are lost when Render restarts, redeploys, or wakes from idling. The client should reconnect/rejoin after a socket close. Render Free currently idles after 15 minutes without inbound HTTP or WebSocket traffic and can take roughly a minute to wake; active WebSocket messages prevent that idling. Keep a demo tab connected or open `/health` shortly before presenting.

## WebRTC connectivity / TURN

For a LAN demo, peers normally establish a direct connection without TURN. STUN helps peers discover public-facing candidates and can be passed to the frontend via `STUN_URLS`. Some NAT/firewall combinations cannot form direct P2P connections; then a TURN relay is required and should be configured through `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. Never hard-code public TURN credentials. Free TURN services are often bandwidth-capped, short-lived, unavailable, or unsuitable for private production traffic; self-hosting coturn can work for a demo but requires a reachable server and relay bandwidth. TURN relays encrypted WebRTC traffic but may carry significant data volume.
