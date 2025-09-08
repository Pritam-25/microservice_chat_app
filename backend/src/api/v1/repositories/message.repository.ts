import { IMessage, Message } from "@/models/message.js";
import type { UpdateQuery } from "mongoose";


export const createMessage = async (data: Partial<IMessage>) => {
  const msg = new Message(data);
  return await msg.save();
}

export const getMessagesByConversation = async (conversationId: string) => {
  // Return oldest -> newest so UI can append at the bottom naturally
  return await Message.find({ conversation: conversationId }).sort({ createdAt: 1 }).exec();
}

export const updateMessageStatusRepo = async (
  messageId: string,
  status: "delivered" | "read",
  userId?: string
) => {
  const update: UpdateQuery<IMessage> = { $set: { status } }
  if (status === "delivered") {
    update.$set.deliveredAt = new Date()
  }
  if (status === "read") {
    update.$set.readAt = new Date()
    if (userId) update.$addToSet = { readBy: userId }
  }
  return await Message.findByIdAndUpdate(messageId, update, { new: true, runValidators: true })
}