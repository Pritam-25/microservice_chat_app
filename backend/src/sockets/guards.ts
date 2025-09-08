import type { Socket } from "socket.io"
import { Types } from "mongoose"
import { Conversation } from "@/models/conversation.js"

export async function assertMembershipOrEmit(
  socket: Socket,
  conversationId?: string
): Promise<{ userId: string } | null> {
  if (!conversationId) {
    socket.emit("error", { error: "Missing conversation id" })
    return null
  }
  const userId = (socket as any).data?.userId as string | undefined
  if (!userId) {
    socket.emit("error", { error: "Unauthorized socket" })
    return null
  }
  if (!Types.ObjectId.isValid(conversationId)) {
    socket.emit("error", { error: "Invalid conversation id" })
    return null
  }
  try {
    const member = await Conversation.exists({ _id: conversationId, participants: userId })
    if (!member) {
      socket.emit("error", { error: "Forbidden or conversation not found" })
      return null
    }
    return { userId }
  } catch {
    socket.emit("error", { error: "Internal server error" })
    return null
  }
}
