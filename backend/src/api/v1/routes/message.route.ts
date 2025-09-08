import { Router } from "express";
import { createMessage, getMessagesByConversation } from "../controllers/message.controller";
import verifyAuth from "@/middleware/verifyAuth";
import ensureParticipant from "@/middleware/ensureParticipant";

const router = Router();

// Require authentication for all message routes
router.post("/:conversationId", verifyAuth, ensureParticipant, createMessage); // POST /messages/:conversationId
router.get("/:conversationId", verifyAuth, ensureParticipant, getMessagesByConversation); // GET /messages/:conversationId

export default router;
