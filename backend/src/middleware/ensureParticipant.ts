import type { Request, Response, NextFunction } from "express"
import { Types } from "mongoose"
import { Conversation } from "@/models/conversation.js"

// Ensures the authenticated user is a participant of the conversation
// For GET /messages/:conversationId -> use req.params.conversationId
// For POST /messages -> use req.body.conversation
export default async function ensureParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUserId
    const conversationId = (req.params?.conversationId ?? req.body?.conversation)?.toString()

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No authenticated user" })
    }

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid or missing conversation id" })
    }

    const convo = await Conversation.findById(conversationId).select("participants").lean()
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" })
    }

    const isParticipant = convo.participants.some((p) => String(p) === String(userId))
    if (!isParticipant) {
      return res.status(403).json({ message: "Forbidden: You are not a participant of this conversation" })
    }

    return next()
  } catch (err: any) {
    return res.status(500).json({ message: "Internal error validating conversation membership" })
  }
}
