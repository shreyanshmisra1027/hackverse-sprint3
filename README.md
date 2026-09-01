# ineVITable

Peer-to-peer communication, in the browser.

# What this is

A web app for direct P2P communication between clients — no central server relaying messages/media once a connection is established.

## Project structure

```
apps/signaling/  WebRTC negotiation WebSocket service
render.yaml      Render Blueprint for the signaling service
```

The repository currently contains the deployable signaling service. A browser
client can be added later and configured to connect to the public `wss://` URL
for this service.

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
