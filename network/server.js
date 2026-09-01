const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const PEER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
});

const io = new Server(server, {
  cors: { origin: false },
  transports: ["websocket"],
  maxHttpBufferSize: 16 * 1024,
});
const peers = new Map(); // peerId -> socketId

function peersExcept(peerId) { return [...peers.keys()].filter((id) => id !== peerId); }

io.on("connection", (socket) => {
  socket.on("join", ({ peerId } = {}) => {
    if (typeof peerId !== "string" || !PEER_ID.test(peerId)) {
      socket.emit("error", { reason: "Peer ID must be 1-64 letters, numbers, _ or -" }); return;
    }
    const existingSocketId = peers.get(peerId);
    if (existingSocketId && existingSocketId !== socket.id) {
      socket.emit("error", { reason: "Peer ID is already in use" }); return;
    }
    socket.peerId = peerId;
    peers.set(peerId, socket.id);
    socket.emit("peer-list", { peers: peersExcept(peerId) });
    socket.broadcast.emit("peer-joined", { peerId });
  });

  socket.on("message", (message = {}) => {
    const { type, to, payload } = message;
    if (!socket.peerId || !["offer", "answer", "ice-candidate"].includes(type) || typeof to !== "string") {
      socket.emit("error", { reason: "Invalid signaling message" }); return;
    }
    const targetSocketId = peers.get(to);
    if (!targetSocketId) { socket.emit("error", { reason: `Peer ${to} not found` }); return; }
    io.to(targetSocketId).emit("message", { type, from: socket.peerId, to, payload });
  });

  socket.on("disconnect", () => {
    if (!socket.peerId || peers.get(socket.peerId) !== socket.id) return;
    peers.delete(socket.peerId);
    socket.broadcast.emit("peer-left", { peerId: socket.peerId });
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Signaling server listening on http://0.0.0.0:${PORT}`));
