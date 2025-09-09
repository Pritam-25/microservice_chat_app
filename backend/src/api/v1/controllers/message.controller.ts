import type { Request, Response } from "express";
import { fetchMessages, sendMessage } from "@/api/v1/services/index.js";
import { Conversation } from "@/models/conversation.js";
import { z, ZodError } from "zod";
import { MessageSchema } from "@/api/v1/schemas/index.js";
import { zId } from "@/api/v1/schemas/index.js";
import { Types } from "mongoose";

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}


export const createMessage = async (req: Request, res: Response) => {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ message: "Unauthorized" })
    }
    // Always trust the authenticated user as the sender, ignore client-provided sender
    const parsed = MessageSchema.parse({ ...req.body, conversation: req.params.conversationId, sender: req.authUserId });
    // Keep IDs as strings; data layer can cast as needed. Membership guard:
    const convo = await Conversation.findById(parsed.conversation).select("participants").lean();
    if (!convo || !convo.participants.some((p: any) => String(p) === String(req.authUserId))) {
      return res.status(403).json({ message: "Forbidden: not a participant" });
    }
    const message = await sendMessage(parsed);

    console.log("✅ Message created:", message);
    res.status(201).json({
      message: "Message created successfully",
      data: message,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      console.error("❌ Zod validation error:", error.issues);
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }

    console.error("❌ Error in createMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessagesByConversation = async (req: Request, res: Response) => {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const parsed = z.object({ conversationId: zId() }).parse(req.params);
    // Ensure membership before returning messages
    const convo = await Conversation.findById(parsed.conversationId).select("participants").lean();
    if (!convo || !convo.participants.some((p: any) => String(p) === String(req.authUserId))) {
      return res.status(403).json({ message: "Forbidden: not a participant" });
    }
    const messages = await fetchMessages(parsed.conversationId);

    console.log(`✅ Retrieved ${messages.length} messages for conversation ${parsed.conversationId}`);
    res.json({
      message: `Fetched ${messages.length} messages successfully`,
      data: messages,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      console.error("❌ Zod validation error:", error.issues);
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }

    console.error("❌ Error in getMessagesByConversation:", error.message);
    res.status(500).json({ message: "Error fetching messages" });
  }
};
