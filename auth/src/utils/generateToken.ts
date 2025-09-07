import jwt from "jsonwebtoken";
import mongoose from "mongoose"

import type { Response } from "express";

export const generateJWT_Token = (userId: mongoose.Types.ObjectId | string, res: Response) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const token = jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "15d" });

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // set to true in production
    sameSite: 'strict',
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
  });

  return token;
};

export default generateJWT_Token;