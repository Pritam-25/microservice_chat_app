import { Router } from "express";
import { createMessage, getMessagesByConversation } from "@/api/v1/controllers/index.js";
import {verifyAuth} from "@/middleware/verifyAuth.js";
import ensureParticipant from "@/middleware/ensureParticipant.js";

const router = Router();

// Require authentication for all message routes
router.post("/:conversationId", verifyAuth, ensureParticipant, createMessage); // POST /messages/:conversationId
router.get("/:conversationId", verifyAuth, ensureParticipant, getMessagesByConversation); // GET /messages/:conversationId

export default router;
