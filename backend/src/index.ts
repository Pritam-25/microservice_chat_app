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
import verifyAuth from "@/middleware/verifyAuth.js";

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

connectDB();

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
app.get("/online-users", verifyAuth, (req: Request, res: Response) => {
  res.json({ users: getOnlineUserIds() })
})

// register socket handlers
io.on("connection", (socket) => {
  // Use conversation-based rooms via message socket handlers
  registerMessageHandlers(io, socket);
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
