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
import { Conversation } from "@/models/conversation.js";

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
  [CHANNELS.NEW_MESSAGE]: async (msg: any) => {
    const inst = process.env.INSTANCE_NAME || 'instance'
    try {
      const convId = String(msg?.conversation || '')
      if (!convId) return

      let participants: string[] = Array.isArray(msg?.participants) ? msg.participants.map((p: any) => String(p)) : []

      // If participants missing, fetch from DB as fallback
      if (!participants.length) {
        try {
          const convo = await Conversation.findById(convId).select('participants')
          if (convo) participants = (convo as any).participants.map((p: any) => String(p))
        } catch (e) {
          console.warn(`⚠️ [${inst}] Failed to fetch participants for ${convId}:`, e)
        }
      }

      const sender = String(msg?.sender || '')
      const targets: string[] = []

      // Emit to each participant's user room (excluding sender)
      for (const p of participants) {
        if (p === sender) continue
        targets.push(`user:${p}`)
        io.to(`user:${p}`).emit('new_message', msg)
      }

      // Also emit to conversation room
      io.to(convId).emit('new_message', msg)

      console.log(`📡 [${inst}] fan-out new_message ${msg?._id || ''} convo=${convId} participants=${participants.length} userRooms=${targets.join(',')}`)
    } catch (e) { console.error(`❌ [${inst}] Redis fan-out new_message error`, e) }
  },
  [CHANNELS.MESSAGE_STATUS]: async (m: any) => {
    const inst = process.env.INSTANCE_NAME || 'instance'
    try {
      const convId = String(m?.conversation || '')
      if (!convId) return

      let participants: string[] = Array.isArray(m?.participants) ? m.participants.map((p: any) => String(p)) : []

      // If participants missing, fetch from DB as fallback
      if (!participants.length) {
        try {
          const convo = await Conversation.findById(convId).select('participants')
          if (convo) participants = (convo as any).participants.map((p: any) => String(p))
        } catch (e) {
          console.warn(`⚠️ [${inst}] Failed to fetch participants for status update ${convId}:`, e)
        }
      }

      // Emit to conversation room
      io.to(convId).emit('message_status', m)

      // Emit to each participant's user room
      const targets: string[] = []
      for (const p of participants) {
        targets.push(`user:${p}`)
        io.to(`user:${p}`).emit('message_status', m)
      }

      console.log(`📡 [${inst}] fan-out message_status ${m?._id || ''} status=${m?.status || ''} convo=${convId} userRooms=${targets.join(',')}`)
    } catch (e) { console.error(`❌ [${inst}] Redis fan-out message_status error`, e) }
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
  },
  [CHANNELS.NEW_CONVERSATION]: async (conv: any) => {
    const inst = process.env.INSTANCE_NAME || 'instance'
    try {
      const convId = String(conv?._id || '')
      if (!convId) return

      let participants: string[] = Array.isArray(conv?.participants) ? conv.participants.map((p: any) => String(p)) : []

      // If participants missing, fetch from DB as fallback
      if (!participants.length) {
        try {
          const convo = await Conversation.findById(convId).select('participants')
          if (convo) participants = (convo as any).participants.map((p: any) => String(p))
        } catch (e) {
          console.warn(`⚠️ [${inst}] Failed to fetch participants for new conversation ${convId}:`, e)
        }
      }

      // Emit to each participant's user room to trigger sidebar refresh
      const targets: string[] = []
      for (const p of participants) {
        targets.push(`user:${p}`)
        io.to(`user:${p}`).emit('new_conversation', conv)
      }

      console.log(`📡 [${inst}] fan-out new_conversation ${convId} name=${conv?.name || ''} participants=${participants.length} userRooms=${targets.join(',')}`)
    } catch (e) { console.error(`❌ [${inst}] Redis fan-out new_conversation error`, e) }
  }
}).catch(err => console.error('❌ Failed to init Redis subscriptions', err))

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down...')
  try { await shutdownRedis() } catch { }
  try { stopPresenceLoops() } catch { }
  try { await new Promise<void>((resolve) => io.close(() => resolve())) } catch { }
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
