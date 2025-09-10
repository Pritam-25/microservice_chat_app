import { Server, Socket } from "socket.io";
import { MessageSchema } from "@/api/v1/schemas/index.js";
import * as messageService from "@/api/v1/services/index.js";
import { Conversation } from "@/models/conversation.js";
import { Message } from "@/models/message.js";
import { assertMembershipOrEmit } from "./guards.js";
import { addOnlineUser, removeOnlineUser } from "./presence.js";
import { publishNewMessage, publishMessageStatus } from "@/redis/messagePubSub.js";
import axios from 'axios'

// TTL (ms) for username cache entries
const USERNAME_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
type UsernameCacheEntry = { value: string; expires: number }
const usernameCache = new Map<string, UsernameCacheEntry>()

function getCachedUsername(userId: string): string | null {
  const entry = usernameCache.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expires) { usernameCache.delete(userId); return null }
  return entry.value
}

async function resolveUsername(userId: string): Promise<string> {
  const cached = getCachedUsername(userId)
  if (cached) return cached
  const base = process.env.AUTH_INTERNAL_URL || process.env.AUTH_URL || 'http://auth:5000'
  try {
    const res = await axios.get(`${base}/api/v1/users/${userId}`)
    const name = res.data?.username || res.data?.user?.username || userId
    usernameCache.set(userId, { value: name, expires: Date.now() + USERNAME_CACHE_TTL_MS })
    return name
  } catch {
    return userId
  }
}

// Track which users we have already invoked addOnlineUser for this socket instance to avoid pointless repeats
// (Distributed presence code already de-duplicates globally; this just minimizes local chatter.)
const localOnlineMark = new Set<string>()

// (Replaced by TTL cache implementation above)

// Main function to register all socket event handlers for messaging
export const registerMessageHandlers = (io: Server, socket: Socket) => {
  console.log("✅ Message socket connected:", socket.id);

  // Extract logged-in userId (set during socket auth middleware)
  const uid = (socket as any).data?.userId as string | undefined

  if (uid) {
    // Track this user as "online" (only once per user/socket pair locally)
    if (!localOnlineMark.has(`${uid}:${socket.id}`)) {
      localOnlineMark.add(`${uid}:${socket.id}`)
      addOnlineUser(uid, socket.id)
    }

    // Join a private room dedicated to this user.
    // Any event sent to `user:<uid>` will reach ALL of this user’s sockets (browser tabs/devices).
    socket.join(`user:${uid}`)

      // Immediately after connection: check for messages that were sent while the user was offline
      ; (async () => {
        try {
          // Find all conversations where this user is a participant
          const convos = await Conversation.find({ participants: uid }).select("_id participants")
          const convoIds = convos.map(c => c._id)

          if (convoIds.length === 0) return

          // Find all "sent" (not delivered yet) messages in those conversations,
          // excluding messages that the user themselves sent
          const pending = await Message.find({
            conversation: { $in: convoIds },
            status: "sent",
            sender: { $ne: uid },
          }).select("_id conversation sender")

          // For each pending message, update its status to "delivered"
          for (const m of pending) {
            const updated = await messageService.updateMessageStatus(String((m as any)._id), "delivered", uid)
            if (!updated) continue

            const convId = String(updated.conversation)

            // Notify all sockets currently in this conversation room
            io.to(convId).emit("message_status", updated)

            // Also notify each participant individually through their user room
            const convo = convos.find(c => String((c as any)._id) === convId)
            if (convo) {
              for (const p of (convo as any).participants) {
                io.to(`user:${String(p)}`).emit("message_status", updated)
              }
            }
          }
        } catch (e) {
          console.error("❌ Error delivering pending messages:", e)
        }
      })()
  }

  // -----------------------
  // Event: join a conversation room
  // -----------------------
  socket.on("join_conversation", async (conversationId: string) => {
    try {
      // Make sure this user is a member of the conversation
      const res = await assertMembershipOrEmit(socket, conversationId)
      if (!res) return

      // Join socket.io room for that conversation
      socket.join(conversationId)
      if (uid) {
        resolveUsername(uid).then(un => {
          console.log(`🟢 user:${un} subscribed to conversation ${conversationId}`)
        })
      } else {
        console.log(`🟢 ${socket.id} subscribed to conversation ${conversationId}`)
      }
    } catch { }
  });

  // -----------------------
  // Event: leave a conversation room
  // -----------------------
  socket.on("leave_conversation", (conversationId: string) => {
    if (!conversationId) return;
    socket.leave(conversationId);
    console.log(`🔴 ${socket.id} left conversation ${conversationId}`);
  });

  // -----------------------
  // Event: send a new message
  // -----------------------
  socket.on("send_message", async (payload) => {
    try {
      // Verify the sender is allowed in this conversation
      const res = await assertMembershipOrEmit(socket, payload?.conversation)
      if (!res) return

      // Validate the incoming payload against schema, attach sender id
      const parsed = MessageSchema.parse({ ...payload, sender: res.userId });

      // Save message to DB with status "sent"
      const saved = await messageService.sendMessage({ ...parsed, status: "sent" } as any);
      // Fetch participants to include in published payload (avoid extra lookups on other instances)
      const convoDoc = await Conversation.findById(parsed.conversation).select('participants')
      if (convoDoc) {
        ; (saved as any).participants = convoDoc.participants.map(p => String(p))
      }
      // Publish so every instance (including this one) will broadcast via subscription handler
      publishNewMessage(saved).catch(e => console.error("❌ Failed to publish new_message", e))
      // Immediate echo back to sender so they see the message instantly (id/timestamps already present)
      socket.emit('new_message', saved)
      if (uid) {
        // Attempt to resolve sender + basic receiver list for log clarity (not blocking)
        const participants: string[] = (saved as any).participants || []
        Promise.all([resolveUsername(uid), ...participants.filter(p => p !== uid).map(p => resolveUsername(p))])
          .then(([senderName, ...others]) => {
            const toList = others.length ? others.join(',') : 'participants'
            console.log(`📩 ${senderName} sent message ${saved._id?.toString?.() || ''} to ${toList}`)
          })
          .catch(() => console.log(`📩 user:${uid} sent message ${saved._id?.toString?.() || ''}`))
      } else {
        console.log("📩 Message persisted & published:", saved._id?.toString?.() ?? "");
      }
    } catch (err: any) {
      console.error("❌ Error in send_message:", err);
      if (err?.issues && Array.isArray(err.issues)) {
        socket.emit("validation_error", err.issues.map((i: any) => i?.message || "Invalid field"))
      } else {
        socket.emit("error", { error: err?.message ?? "Invalid message payload" })
      }
    }
  });

  // -----------------------
  // Event: mark message as delivered
  // -----------------------
  socket.on("message_delivered", async ({ messageId }) => {
    try {
      const userId = (socket as any).data?.userId as string | undefined
      if (!userId || !messageId) return socket.emit("error", { error: "Unauthorized or invalid payload" })

      // Verify the user is part of the conversation for this message
      const meta = await Message.findById(messageId).select("conversation")
      if (!meta) return socket.emit("error", { error: "Message not found" })
      const convo = await Conversation.findById(meta.conversation).select("participants")
      const isMember = !!(convo && convo.participants.some((p) => String(p) === String(userId)))
      if (!isMember) return socket.emit("error", { error: "Forbidden" })

      // Update message status to "delivered"
      const updated = await messageService.updateMessageStatus(messageId, "delivered", userId)
      if (!updated) return

      const convId = String(updated.conversation)
      // Attach participants for cross-instance fan-out
      if (convo) (updated as any).participants = convo.participants.map(p => String(p))
      // Publish update for cross-instance fan-out
      publishMessageStatus(updated).catch(e => console.error("❌ Failed to publish delivered status", e))
      console.log("✅ Delivered (published):", messageId)
    } catch (err) {
      console.error("❌ Error in message_delivered:", err)
    }
  })

  // -----------------------
  // Event: mark message as read
  // -----------------------
  socket.on("message_read", async ({ messageId }) => {
    try {
      const userId = (socket as any).data?.userId as string | undefined
      if (!userId || !messageId) return socket.emit("error", { error: "Unauthorized or invalid payload" })

      // Verify membership in conversation
      const meta = await Message.findById(messageId).select("conversation")
      if (!meta) return socket.emit("error", { error: "Message not found" })
      const convo = await Conversation.findById(meta.conversation).select("participants")
      const isMember = !!(convo && convo.participants.some((p) => String(p) === String(userId)))
      if (!isMember) return socket.emit("error", { error: "Forbidden" })

      // Update status to "read"
      const updated = await messageService.updateMessageStatus(messageId, "read", userId)
      if (!updated) return

      const convId = String(updated.conversation)
      if (convo) (updated as any).participants = convo.participants.map(p => String(p))
      publishMessageStatus(updated).catch(e => console.error("❌ Failed to publish read status", e))
      console.log("👀 Read (published):", messageId)
    } catch (err) {
      console.error("❌ Error in message_read:", err)
    }
  })

  // -----------------------
  // Event: socket disconnected
  // -----------------------
  socket.on("disconnecting", () => {
    try {
      console.log(`🔌 ${socket.id} disconnecting; rooms=`, Array.from(socket.rooms))
    } catch { }
  })

  socket.on("disconnect", () => {
    const uid = (socket as any).data?.userId as string | undefined
    if (uid) removeOnlineUser(uid, socket.id)
    console.log("❌ Message socket disconnected:", socket.id);
  });
};
