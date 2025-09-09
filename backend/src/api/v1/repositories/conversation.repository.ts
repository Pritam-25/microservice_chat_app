import { Types } from "mongoose"
import { Conversation, IConversation } from "@/models/conversation.js"

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
  // Runtime validation (defense in depth)
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("participants must be a non-empty array")
  }
  if (!Array.isArray(admins) || admins.length === 0) {
    throw new Error("admins must be a non-empty array")
  }
  const allIdsValid = [...participants, ...admins].every(id => Types.ObjectId.isValid(id))
  if (!allIdsValid) {
    throw new Error("One or more participant/admin ids are invalid ObjectId values")
  }
  // De-duplicate participants & admins
  const dedupParticipants = Array.from(new Set(participants.map(id => id.toString()))).map(id => new Types.ObjectId(id))
  const dedupAdmins = Array.from(new Set(admins.map(id => id.toString()))).map(id => new Types.ObjectId(id))
  // Ensure admins subset of participants
  const participantsSet = new Set(dedupParticipants.map(id => id.toString()))
  const missingAdmin = dedupAdmins.find(a => !participantsSet.has(a.toString()))
  if (missingAdmin) {
    throw new Error("All admins must also be participants")
  }
  return await Conversation.create({
    isGroup: true,
    name,
    gKey,
    participants: dedupParticipants,
    admins: dedupAdmins,
    avatarUrl,
    unread: dedupParticipants.map((id) => ({ user: id, count: 0 })),
  })
}

export const getConversationsByUserRepo = async (userId: string) => {
  return await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate("lastMessage")
}
