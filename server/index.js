const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }

  let filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcast(room, message, excludeSocket) {
  const data = JSON.stringify(message);
  for (const client of room.listeners) {
    if (client !== excludeSocket && client.readyState === 1) {
      client.send(data);
    }
  }
}

function removeFromRoom(ws) {
  const roomCode = ws._roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  room.listeners.delete(ws);

  if (room.dj === ws) {
    room.dj = null;
    broadcast(room, { type: "dj-left" });

    if (room.listeners.size > 0) {
      const next = room.listeners.values().next().value;
      room.dj = next;
      next.send(JSON.stringify({ type: "promoted-to-dj" }));
      broadcast(room, { type: "new-dj", name: next._name }, next);
    }
  }

  broadcast(room, {
    type: "member-left",
    name: ws._name,
    count: room.listeners.size,
  });

  if (room.listeners.size === 0) {
    rooms.delete(roomCode);
    console.log(`Room ${roomCode} deleted (empty)`);
  }

  ws._roomCode = null;
}

wss.on("connection", (ws) => {
  ws._name = "Listener";

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "create-room": {
        removeFromRoom(ws);
        let code = generateRoomCode();
        while (rooms.has(code)) code = generateRoomCode();

        ws._name = msg.name || "DJ";
        ws._roomCode = code;

        rooms.set(code, {
          dj: ws,
          listeners: new Set([ws]),
          state: null,
        });

        ws.send(JSON.stringify({ type: "room-created", code }));
        console.log(`Room ${code} created by ${ws._name}`);
        break;
      }

      case "join-room": {
        const code = (msg.code || "").toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }

        removeFromRoom(ws);
        ws._name = msg.name || "Listener";
        ws._roomCode = code;
        room.listeners.add(ws);

        ws.send(
          JSON.stringify({
            type: "room-joined",
            code,
            isDj: false,
            count: room.listeners.size,
          })
        );

        broadcast(room, {
          type: "member-joined",
          name: ws._name,
          count: room.listeners.size,
        }, ws);

        if (room.state) {
          ws.send(JSON.stringify({ type: "sync", ...room.state }));
        }
        break;
      }

      case "sync": {
        const room = rooms.get(ws._roomCode);
        if (!room || room.dj !== ws) return;

        room.state = {
          videoId: msg.videoId,
          currentTime: msg.currentTime,
          playing: msg.playing,
          timestamp: Date.now(),
          title: msg.title,
        };

        broadcast(room, { type: "sync", ...room.state }, ws);
        break;
      }

      case "play":
      case "pause":
      case "seek": {
        const room = rooms.get(ws._roomCode);
        if (!room || room.dj !== ws) return;
        broadcast(room, { type: msg.type, currentTime: msg.currentTime }, ws);
        break;
      }

      case "change-video": {
        const room = rooms.get(ws._roomCode);
        if (!room || room.dj !== ws) return;
        room.state = {
          videoId: msg.videoId,
          currentTime: 0,
          playing: true,
          timestamp: Date.now(),
          title: msg.title,
        };
        broadcast(room, { type: "change-video", ...room.state }, ws);
        break;
      }

      case "request-sync": {
        const room = rooms.get(ws._roomCode);
        if (!room) return;
        if (room.state) {
          ws.send(JSON.stringify({ type: "sync", ...room.state }));
        }
        break;
      }

      case "take-dj": {
        const room = rooms.get(ws._roomCode);
        if (!room) return;
        if (room.dj) {
          room.dj.send(JSON.stringify({ type: "demoted-from-dj" }));
        }
        room.dj = ws;
        ws.send(JSON.stringify({ type: "promoted-to-dj" }));
        broadcast(room, { type: "new-dj", name: ws._name }, ws);
        break;
      }
    }
  });

  ws.on("close", () => removeFromRoom(ws));
  ws.on("error", () => removeFromRoom(ws));
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "localhost";
}

server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  console.log(`\nYT Sync is running!\n`);
  console.log(`  Open on this device:  http://localhost:${PORT}`);
  console.log(`  Open on other devices: http://${ip}:${PORT}`);
  console.log(`\nAll devices must be on the same WiFi network.\n`);
});
