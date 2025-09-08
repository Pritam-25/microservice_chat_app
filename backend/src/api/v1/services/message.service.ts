import { IMessageInput } from "@/api/v1/schemas/message.schema.js";
import { Types } from "mongoose";
import { Conversation } from "@/models/conversation.js";
import { createMessage, getMessagesByConversation, updateMessageStatusRepo } from "@/api/v1/repositories/index.js";

export const sendMessage = async (data: IMessageInput) => {
  // Convert string ObjectId fields to Types.ObjectId
  const messageData = {
    ...data,
    conversation: new Types.ObjectId(data.conversation),
    sender: new Types.ObjectId(data.sender),
    receiver: data.receiver ? new Types.ObjectId(data.receiver) : undefined,
  };

  // Safety: ensure sender is a participant of the conversation
  const convo = await Conversation.findById(messageData.conversation).select("participants");
  if (!convo) throw new Error("Conversation not found");
  const senderId = messageData.sender;
  const isParticipant = convo.participants.some((p) => p.toString() === senderId.toString());
  if (!isParticipant) throw new Error("Sender is not a participant of this conversation");

  const message = await createMessage(messageData);

  // Update conversation: set lastMessage and increment unread for all except sender
  await Conversation.findByIdAndUpdate(
    data.conversation,
    {
      $set: { lastMessage: message._id },
      $inc: { "unread.$[e].count": 1 },
    },
    {
      arrayFilters: [{ "e.user": { $ne: senderId } }],
    }
  )

  return message;
};


export const fetchMessages = async (conversationId: string) => {
  const messages = await getMessagesByConversation(conversationId);
  return messages;
};

export const updateMessageStatus = async (
  messageId: string,
  status: "delivered" | "read",
  userId?: string
) => {
  const updated = await updateMessageStatusRepo(messageId, status, userId)
  // If user read a message, reset unread counter for that user in the conversation
  if (updated && status === "read" && userId) {
    await Conversation.updateOne(
      { _id: updated.conversation, "unread.user": new Types.ObjectId(userId) },
      { $set: { "unread.$.count": 0 } }
    )
  }
  return updated
}
