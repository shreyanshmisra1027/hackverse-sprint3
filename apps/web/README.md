# ineVITable web

Minimal Vite + React + TypeScript skeleton for deployment to Vercel.

## Local development

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Set `VITE_SIGNALING_URL` to the public WebSocket URL of the signaling server.
The page has a single Connect button that verifies the browser can open that
socket. Room, WebRTC, and messaging features are intentionally not included.

## Vercel

Set the Vercel project root directory to `apps/web`, use `npm run build` as the
build command, and publish `dist`. Add `VITE_SIGNALING_URL` to the project's
environment variables before deploying.
