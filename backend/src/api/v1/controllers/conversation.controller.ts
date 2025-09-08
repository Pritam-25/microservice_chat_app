import { Request, Response } from "express"
import {
  getOrCreatePairService,
  createGroupConversationService,
  getUserConversationsService,
} from "@/api/v1/services/index.js"
import { ZodError } from "zod";
import {
  CreatePairBodySchema,
  CreateGroupBodySchema,
  GetUserConversationsParamsSchema,
} from "@/api/v1/schemas/index.js";



// Create or get a 1:1 conversation
export async function createPairConversation(req: Request, res: Response) {
  try {
    const parsed = CreatePairBodySchema.parse(req.body)
    const userIds = "participants" in parsed ? parsed.participants : [parsed.userA, parsed.userB]
    if (userIds.length !== 2) {
      return res.status(400).json({ message: "Exactly two participant IDs are required" })
    }
    const [userA, userB] = userIds
    if (String(userA) === String(userB)) {
      return res.status(400).json({ message: "Cannot create a 1:1 conversation with the same user" })
    }
    console.log("🔹 createPairConversation called with:", { userA, userB })

    // Authorization: requester must be one of the two participants
    const requesterId = req.authUserId
    if (!requesterId || (requesterId !== String(userA) && requesterId !== String(userB))) {
      return res.status(403).json({ message: "Forbidden: You can only create a pair with yourself as one participant" })
    }

    const convo = await getOrCreatePairService(userA, userB)
    console.log("✅ Conversation returned:", convo)

    res.status(201).json({
      message: "1:1 conversation created or fetched successfully",
      conversation: convo,
    })
  } catch (err: any) {
    if (err instanceof ZodError) {
      console.error("❌ Zod validation error:", err.issues);
      return res.status(400).json({
        message: "Validation error",
        errors: err.issues,
      });
    }
    console.error("❌ Error in createPairConversation:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// Create a group conversation
export async function createGroupConversation(req: Request, res: Response) {
  try {
    // Prefer createdBy from auth; fall back to body for backward compatibility
    const parsed = CreateGroupBodySchema.parse(req.body)
    const createdBy = (req.authUserId ?? parsed.createdBy) as string
    const { name, participants, admins, avatarUrl } = parsed

    // ensure creator is part of participants (dedup first)
    const baseParticipants = Array.from(new Set(participants))
    const ensureParticipants = baseParticipants.includes(createdBy)
      ? baseParticipants
      : [...baseParticipants, createdBy]

    // admins default to [createdBy] and ensure creator present even if admins provided
    const mergedAdmins = admins ? [...admins, createdBy] : [createdBy]
    const finalAdmins = Array.from(new Set(mergedAdmins))

    // Authorization: requester must be the creator
    if (!req.authUserId || String(req.authUserId) !== String(createdBy)) {
      return res.status(403).json({ message: "Forbidden: createdBy must match authenticated user" })
    }

    console.log("🔹 createGroupConversation called with:", { name, participants: ensureParticipants, admins: finalAdmins, avatarUrl, createdBy })

    const convo = await createGroupConversationService(name, ensureParticipants, finalAdmins, avatarUrl)
    console.log("✅ Group conversation created:", convo)

    res.status(201).json({
      message: "Group conversation created successfully",
      conversation: convo,
    })
  } catch (err: any) {
    if (err instanceof ZodError) {
      console.error("❌ Zod validation error:", err.issues);
      return res.status(400).json({
        message: "Validation error",
        errors: err.issues,
      });
    }
    // Handle Mongo duplicate key error (race condition on unique index)
    if ((err?.name === "MongoServerError" || err?.code === 11000) && err?.code === 11000) {
      console.warn("⚠️ Duplicate group (DB unique index) attempt:", err?.keyValue)
      return res.status(409).json({
        message: "Duplicate group",
        error: "A group with the same name and participants already exists",
        details: err?.keyValue,
      })
    }
    if (typeof err?.message === "string" && err.message.includes("already exists")) {
      console.warn("⚠️ Duplicate group creation attempt:", err.message)
      return res.status(409).json({
        message: "Duplicate group",
        error: err.message,
      })
    }
    console.error("❌ Error in createGroupConversation:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// Get all conversations for a user
export async function getUserConversations(req: Request, res: Response) {
  try {
    const { userId } = GetUserConversationsParamsSchema.parse(req.params)
    console.log("🔹 getUserConversations called for userId:", userId)

    // Authorization: can only fetch own conversations
    if (!req.authUserId || String(req.authUserId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden: You can only fetch your own conversations" })
    }

    const convos = await getUserConversationsService(userId)
    console.log(`✅ Found ${convos.length} conversations for user ${userId}`)

    res.json({
      message: `Fetched ${convos.length} conversations successfully`,
      conversations: convos,
    })
  } catch (err: any) {
    if (err instanceof ZodError) {
      console.error("❌ Zod validation error:", err.issues);
      return res.status(400).json({
        message: "Validation error",
        errors: err.issues,
      });
    }
    console.error("❌ Error in getUserConversations:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}
