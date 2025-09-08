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
  // Build deterministic gKey: lowercase trimmed name + sorted participant ids
  const normalizedName = name.trim().toLowerCase()
  const uniqueParticipants = Array.from(new Set(participants))
  const sortedParticipants = uniqueParticipants.sort()
  const gKey = `${normalizedName}:${sortedParticipants.join(":")}`

  // Check for duplicate group with same name and participants
  const existing = await findGroupByGKeyRepo(gKey)
  if (existing) {
    throw new Error("A group with the same name and participants already exists")
  }

  const uniqueAdmins = Array.from(new Set(admins))
  const convo = await createGroupRepo({
    name,
    gKey,
    participants: uniqueParticipants.map((id) => new Types.ObjectId(id)),
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
