import { Server, Socket } from "socket.io";
import { MessageSchema } from "@/api/v1/schemas/message.zod";
import * as messageService from "@/api/v1/services/message.service";
import { Conversation } from "@/models/conversation";
import { Message } from "@/models/message";
import { assertMembershipOrEmit } from "./guards";
import { addOnlineUser, removeOnlineUser } from "./presence";

export const registerMessageHandlers = (io: Server, socket: Socket) => {
  console.log("✅ Message socket connected:", socket.id);
  const uid = (socket as any).data?.userId as string | undefined
  if (uid) {
    addOnlineUser(uid, socket.id)
    // Join a private user room to receive events even when a specific conversation room isn't joined
    socket.join(`user:${uid}`)
      // On connect: mark any pending messages as delivered for this user (they were offline when messages were sent)
      ; (async () => {
        try {
          const convos = await Conversation.find({ participants: uid }).select("_id participants")
          const convoIds = convos.map(c => c._id)
          if (convoIds.length === 0) return
          const pending = await Message.find({
            conversation: { $in: convoIds },
            status: "sent",
            sender: { $ne: uid },
          }).select("_id conversation sender")
          for (const m of pending) {
            const updated = await messageService.updateMessageStatus(String((m as any)._id), "delivered", uid)
            if (!updated) continue
            const convId = String(updated.conversation)
            io.to(convId).emit("message_status", updated)
            // Notify all convo participants via their user rooms as well
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

  // Join a conversation room
  socket.on("join_conversation", async (conversationId: string) => {
    try {
      const res = await assertMembershipOrEmit(socket, conversationId)
      if (!res) return
      socket.join(conversationId)
      console.log(`🟢 ${socket.id} joined conversation ${conversationId}`)
    } catch { }
  });

  // Leave a conversation room
  socket.on("leave_conversation", (conversationId: string) => {
    if (!conversationId) return;
    socket.leave(conversationId);
    console.log(`🔴 ${socket.id} left conversation ${conversationId}`);
  });

  // Send a message
  socket.on("send_message", async (payload) => {
    try {
      const res = await assertMembershipOrEmit(socket, payload?.conversation)
      if (!res) return
      const parsed = MessageSchema.parse({ ...payload, sender: res.userId });

      const saved = await messageService.sendMessage({ ...parsed, status: "sent" } as any);
      // Notify each participant via their private user room (ensures delivery even if they haven't joined the convo room)
      const convo = await Conversation.findById(parsed.conversation).select("participants")
      if (convo) {
        for (const p of convo.participants) {
          if (String(p) === String(res.userId)) continue // skip sender
          io.to(`user:${String(p)}`).emit("new_message", saved)
        }
      }
      // Also inform the sender (acknowledgement with saved id/timestamps)
      socket.emit("new_message", saved);
      console.log("📩 Message sent:", saved._id?.toString?.() ?? "");
    } catch (err: any) {
      console.error("❌ Error in send_message:", err);
      socket.emit("error", { error: err?.issues ?? err?.message ?? "Invalid message payload" });
    }
  });

  // Mark message as delivered (userId from authenticated socket)
  socket.on("message_delivered", async ({ messageId }) => {
    try {
      const userId = (socket as any).data?.userId as string | undefined
      if (!userId || !messageId) return socket.emit("error", { error: "Unauthorized or invalid payload" })
      const updated = await messageService.updateMessageStatus(messageId, "delivered", userId)
      if (!updated) return
      // Membership already checked by assertMembershipOrEmit for user existence; we can still ensure membership on convo:
      const convo = await Conversation.findById(updated.conversation).select("participants")
      const isMember = convo && convo.participants.some((p) => String(p) === String(userId))
      if (!isMember) return
      const convId = updated.conversation.toString()
      io.to(convId).emit("message_status", updated)
      // Also notify participants via user rooms so status reaches them even if not in the convo room
      const convo2 = await Conversation.findById(updated.conversation).select("participants")
      if (convo2) {
        for (const p of convo2.participants) {
          io.to(`user:${String(p)}`).emit("message_status", updated)
        }
      }
      console.log("✅ Delivered:", messageId)
    } catch (err) {
      console.error("❌ Error in message_delivered:", err)
    }
  })

  // Mark message as read (userId from authenticated socket)
  socket.on("message_read", async ({ messageId }) => {
    try {
      const userId = (socket as any).data?.userId as string | undefined
      if (!userId || !messageId) return socket.emit("error", { error: "Unauthorized or invalid payload" })
      const updated = await messageService.updateMessageStatus(messageId, "read", userId)
      if (!updated) return
      const convo = await Conversation.findById(updated.conversation).select("participants")
      const isMember = convo && convo.participants.some((p) => String(p) === String(userId))
      if (!isMember) return
      const convId = updated.conversation.toString()
      io.to(convId).emit("message_status", updated)
      const convo2 = await Conversation.findById(updated.conversation).select("participants")
      if (convo2) {
        for (const p of convo2.participants) {
          io.to(`user:${String(p)}`).emit("message_status", updated)
        }
      }
      console.log("👀 Read:", messageId)
    } catch (err) {
      console.error("❌ Error in message_read:", err)
    }
  })

  socket.on("disconnect", () => {
    const uid = (socket as any).data?.userId as string | undefined
    if (uid) removeOnlineUser(uid, socket.id)
    console.log("❌ Message socket disconnected:", socket.id);
  });
};

