import { Router } from "express"
import {
  createPairConversation,
  createGroupConversation,
  getUserConversations,
} from "@/api/v1/controllers/index.js"
import {verifyAuth} from "@/middleware/verifyAuth.js"
import ensureSameUserParam from "@/middleware/ensureSameUserParam.js"

const router = Router()

// POST /api/conversations/pair
router.post("/pair", verifyAuth, createPairConversation)

// POST /api/conversations/group
router.post("/group", verifyAuth, createGroupConversation)

// GET /api/conversations/:userId
router.get("/:userId", verifyAuth, ensureSameUserParam("userId"), getUserConversations)

export default router
