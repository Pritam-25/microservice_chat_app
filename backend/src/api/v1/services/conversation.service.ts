import { Types } from "mongoose"
import {
  getOrCreatePairRepo,
  findGroupByGKeyRepo,
  createGroupRepo,
  getConversationsByUserRepo,
} from "@/api/v1/repositories/index.js"


// Get or create 1:1 conversation
export async function getOrCreatePairService(userA: string, userB: string) {
  const [a, b] = [String(userA), String(userB)].sort()
  const convo = await getOrCreatePairRepo(
    new Types.ObjectId(a),
    new Types.ObjectId(b)
  )
  return convo
}

// Create group conversation
export async function createGroupConversationService(
  name: string,
  participants: string[],
  admins: string[],
  avatarUrl?: string
) {
  // Normalize & merge: admins must be members before computing deterministic gKey
  const normalizedName = name.trim().toLowerCase()
  const uniqueParticipants = Array.from(new Set(participants.map(String)))
  const uniqueAdmins = Array.from(new Set(admins.map(String)))
  const finalParticipants = Array.from(new Set([...uniqueParticipants, ...uniqueAdmins]))
  const sortedParticipants = [...finalParticipants].sort()
  const gKey = `${normalizedName}:${sortedParticipants.join(":")}`

  // Prevent duplicate group (same normalized name + participant set)
  const existing = await findGroupByGKeyRepo(gKey)
  if (existing) {
    throw new Error("A group with the same name and participants already exists")
  }

  const convo = await createGroupRepo({
    name,
    gKey,
    participants: finalParticipants.map((id) => new Types.ObjectId(id)),
    admins: uniqueAdmins.map((id) => new Types.ObjectId(id)),
    avatarUrl,
  })

  return convo
}

// Get all conversations for a user
export async function getUserConversationsService(userId: string) {
  const convos = await getConversationsByUserRepo(userId)
  return convos
}
