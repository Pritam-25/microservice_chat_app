import { Types } from "mongoose"
import { Conversation, IConversation } from "@/models/conversation"

export const getOrCreatePairRepo = async (
  userA: Types.ObjectId,
  userB: Types.ObjectId
) => {
  return await Conversation.getOrCreatePair(userA, userB)
}

export const findGroupByGKeyRepo = async (gKey: string) => {
  return await Conversation.findOne({ gKey })
}

export const createGroupRepo = async (data: {
  name: string
  participants: Types.ObjectId[]
  admins: Types.ObjectId[]
  avatarUrl?: string
  gKey: string
}) => {
  const { name, participants, admins, avatarUrl, gKey } = data
  return await Conversation.create({
    isGroup: true,
    name,
    gKey,
    participants,
    admins,
    avatarUrl,
    unread: participants.map((id) => ({ user: id, count: 0 })),
  })
}

export const getConversationsByUserRepo = async (userId: string) => {
  return await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate("lastMessage")
}
