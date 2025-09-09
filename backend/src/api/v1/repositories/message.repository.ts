import { IMessage, Message } from "@/models/message.js";
import { Types } from "mongoose";
import type { UpdateQuery, FilterQuery } from "mongoose";


type CreateMessageInput = Pick<IMessage, "conversation" | "sender" | "receiver" | "type" | "text" | "attachments">;

export const createMessage = async (data: Partial<IMessage>) => {
  // Whitelist allowed client-provided fields to avoid mass assignment
  const { conversation, sender, receiver, type, text, attachments } = data as CreateMessageInput;
  const payload: CreateMessageInput = { conversation, sender, receiver, type, text, attachments };
  const msg = new Message(payload);
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
  const now = new Date()
  const filter: FilterQuery<IMessage> = { _id: messageId }
  const update: UpdateQuery<IMessage> = { $set: { status } }

  if (status === "delivered") {
    // Prevent downgrading a message already marked as read
    filter.status = { $ne: "read" }
    update.$set.deliveredAt = now
    if (userId && Types.ObjectId.isValid(userId)) {
      update.$addToSet = { ...(update.$addToSet || {}), deliveredBy: new Types.ObjectId(userId) }
    }
  } else { // status === 'read'
    // Mark read implies delivered
    update.$set.readAt = now
    update.$set.deliveredAt = now
    if (userId && Types.ObjectId.isValid(userId)) {
      update.$addToSet = { readBy: new Types.ObjectId(userId) }
    }
  }
  return await Message.findOneAndUpdate(filter, update, { new: true, runValidators: true })
}