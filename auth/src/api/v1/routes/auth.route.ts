import express from 'express';
import type { Request, Response } from "express";
import { resetPassword, forgotPassword, logout, signup, login } from '@/api/v1/controllers/auth.controller';

const router = express.Router();

router.get('/status', (req: Request, res: Response) => {
  res.json({ status: 'Auth service is running' });
});

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post("/reset-password/:token", resetPassword);
export default router;