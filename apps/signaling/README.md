# HackVerse Signaling Server

WebSocket signaling server for peer-to-peer encrypted messaging and file sharing.

## Architecture

The server **only** facilitates WebRTC connection establishment. It does not relay messages, files, or keys.

```
Browser A <--WebSocket--> Signaling Server <--WebSocket--> Browser B
         <================ WebRTC P2P (encrypted) ================>
```

## What This Server Does

- Manages rooms and peer discovery
- Relays SDP offers/answers and ICE candidates
- Notifies peers of joins/leaves
- Enforces rate limits and connection caps

## What This Server Does NOT Do

- ❌ No message storage or relay
- ❌ No file storage or relay
- ❌ No key storage
- ❌ No database
- ❌ No paid infrastructure dependencies

## Local Development

```bash
cd apps/signaling
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

Server will start on `ws://localhost:8080` with health endpoint at `http://localhost:8080/health`.

## Production Deployment

### Recommended Free Hosting Options

#### Option 1: Render.com (Recommended)
- Free tier supports WebSockets
- 750 hours/month free
- Persistent connections
- Auto-deploy from GitHub

**Steps:**
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repo, select `apps/signaling` as root
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Set environment variables in dashboard
7. Deploy

#### Option 2: Railway.app
- $5 free credit/month
- Supports WebSockets
- Auto-deploy from GitHub

#### Option 3: Fly.io
- Free tier with small VMs
- Supports WebSockets
- Requires credit card (no charges on free tier)

#### Option 4: Cyclic.sh
- Free tier
- WebSocket support
- Auto-deploy

### Environment Variables for Production

```env
PORT=8080
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app.pages.dev
```

### TURN Server (Optional Fallback)

WebRTC works peer-to-peer for most connections using STUN. TURN is only needed for ~10% of cases (symmetric NAT).

**Free TURN options:**
- **selfhost.de** - Free TURN server (limited)
- **Metered.ca** - Free tier with 500GB/month
- **Your own coturn** - Self-host on a free VM

For the hackathon, TURN is optional. The frontend can work with STUN-only for most cases.

## Signaling Protocol

All messages are JSON over WebSocket.

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `join` | Client → Server | Join a room |
| `joined` | Server → Client | Confirmation with existing peers |
| `peer-joined` | Server → Client | Another peer joined |
| `leave` | Client → Server | Leave a room |
| `peer-left` | Server → Client | Another peer left |
| `offer` | Client → Server → Client | SDP offer |
| `answer` | Client → Server → Client | SDP answer |
| `candidate` | Client → Server → Client | ICE candidate |
| `error` | Server → Client | Error message |

### Message Format

```json
{
  "type": "join",
  "roomId": "abc123",
  "peerId": "peer-xyz"
}
```

```json
{
  "type": "offer",
  "roomId": "abc123",
  "peerId": "peer-a",
  "targetPeerId": "peer-b",
  "payload": { "sdp": "..." }
}
```

### Connection Flow

1. **Client A** sends `join` → Server responds with `joined` (list of existing peers)
2. **Client B** sends `join` → Server broadcasts `peer-joined` to A
3. **Client A** creates offer → sends `offer` to server with `targetPeerId: B`
4. Server forwards to B
5. **Client B** creates answer → sends `answer` to server with `targetPeerId: A`
6. Server forwards to A
7. Both exchange ICE candidates via `candidate` messages
8. WebRTC P2P connection established
9. All further communication is direct peer-to-peer (encrypted)

## Security Considerations

- **Origin validation** - Enforced via `ALLOWED_ORIGINS`
- **Connection limits** - 100 concurrent connections (configurable)
- **Payload size** - Max 64KB per message
- **Rate limiting** - 30 messages per 10 seconds per connection
- **No logging of payloads** - Server only logs connection events, never message contents
- **No persistence** - All state in memory, cleared on restart
- **Room cleanup** - Empty rooms auto-deleted

## Files

- `src/server.ts` - HTTP server + health endpoint + WebSocket attachment
- `src/websocket.ts` - WebSocket connection handling and message routing
- `src/rooms.ts` - In-memory room and peer management
- `src/protocol.ts` - Message type definitions
- `src/validation.ts` - Input validation and sanitization

## Health Check

```bash
curl http://localhost:8080/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-09-01T...",
  "rooms": 5,
  "uptime": 3600
}
```

## Free Hosting Assumptions & Limitations

- **Render.com free tier**: Spins down after 15min inactivity (cold starts ~30s)
- **Railway**: $5/month credit, may run out
- **Fly.io**: Requires credit card on file (no charges on free tier)
- **TURN servers**: Most free tiers have bandwidth limits; treat TURN as fallback only

For a hackathon demo, Render.com free tier is the most reliable option.

## Integration

### Frontend Connection

```javascript
const ws = new WebSocket('wss://your-signaling-server.onrender.com');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    roomId: 'my-room',
    peerId: 'user-123'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Handle signaling messages
};
```

### WebRTC Integration

After receiving `joined` or `peer-joined`:
1. Create `RTCPeerConnection`
2. Add local stream/tracks
3. If you have a lower peer ID, create offer
4. Send offer/answer/candidates via signaling server
5. Once connected, communicate directly (P2P)
