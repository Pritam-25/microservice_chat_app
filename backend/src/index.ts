import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import ConversationRouter from "@/api/v1/routes/conversation.route.js";
import messageRoutes from "@/api/v1/routes/message.route.js";
import connectDB from "@/config/db.js";
import { registerMessageHandlers, registerSocketAuth, getOnlineUserIds } from "@/sockets/index.js";
import { getGlobalOnlineUsers, stopPresenceLoops } from "@/sockets/presence.js";
import { verifyAuth } from "@/middleware/verifyAuth.js";
import { initSubscriptions, CHANNELS, shutdownRedis } from "@/redis/messagePubSub.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ],
  credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
// Protect conversation routes (creation + listing) by default; can scope per-route inside router too
app.use("/api/v1/conversations", ConversationRouter);
app.use("/api/v1/messages", messageRoutes);


const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authenticate sockets (JWT from cookie/header/auth)
registerSocketAuth(io);

app.get("/", (req: Request, res: Response) => {
  res.send("🚀 Hello from Backend Service");
});

// Optional: query online users (requires auth)
app.get("/online-users", verifyAuth, async (req: Request, res: Response) => {
  // If scaling horizontally, prefer global list
  const global = await getGlobalOnlineUsers()
  res.json({ users: global.length ? global : getOnlineUserIds() })
})

// register socket handlers
io.on("connection", (socket) => {
  // Use conversation-based rooms via message socket handlers
  registerMessageHandlers(io, socket);
});

// Initialize Redis pub/sub subscriptions (no-op if Redis not configured)
initSubscriptions({
  [CHANNELS.NEW_MESSAGE]: (msg: any) => {
    try {
      const convId = String(msg?.conversation || '')
      if (convId) {
        // Emit to each participant individually (user rooms) + conversation room
        if (Array.isArray(msg?.participants)) {
          for (const p of msg.participants) {
            if (String(p) === String(msg?.sender)) continue
            io.to(`user:${String(p)}`).emit('new_message', msg)
          }
        }
        io.to(convId).emit('new_message', msg)
      }
    } catch (e) { console.error('❌ Redis fan-out new_message error', e) }
  },
  [CHANNELS.MESSAGE_STATUS]: (m: any) => {
    try {
      const convId = String(m?.conversation || '')
      if (convId) {
        io.to(convId).emit('message_status', m)
        if (Array.isArray(m?.participants)) {
          for (const p of m.participants) io.to(`user:${String(p)}`).emit('message_status', m)
        }
      }
    } catch (e) { console.error('❌ Redis fan-out message_status error', e) }
  },
  [CHANNELS.PRESENCE]: (p: any) => {
    try {
      if (!p || !p.userId || !p.action) return
      const payload = {
        userId: String(p.userId),
        status: p.action === 'online' ? 'online' : 'offline',
        at: typeof p.at === 'number' ? p.at : Date.now(),
        stale: !!p.stale,
      }
      io.emit('presence_update', payload)
    } catch (e) { console.error('❌ Redis fan-out presence error', e) }
  }
}).catch(err => console.error('❌ Failed to init Redis subscriptions', err))

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down...')
  try { await shutdownRedis() } catch { }
  try { stopPresenceLoops() } catch { }
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)


connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("❌ Failed to connect to DB:", err);
  process.exit(1);
});
