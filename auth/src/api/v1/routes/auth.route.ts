import express from 'express';
import type { Request, Response } from "express";
import { resetPassword, forgotPassword, logout, signup, login } from '@/api/v1/controllers/auth.controller.js';

import rateLimit from 'express-rate-limit';

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const pwLimiter    = rateLimit({ windowMs: 60 * 60 * 1000,  limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

router.get('/status', (req: Request, res: Response) => {
  res.json({ status: 'Auth service is running' });
});

router.post('/signup', authLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout', authLimiter, logout);
router.post('/forgot-password', pwLimiter, forgotPassword);
router.post("/reset-password/:token", pwLimiter, resetPassword);
export default router;