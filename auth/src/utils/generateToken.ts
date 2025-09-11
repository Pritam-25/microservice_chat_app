import jwt from "jsonwebtoken";
import mongoose from "mongoose"

import type { Response } from "express";

export const generateJWT_Token = (userId: mongoose.Types.ObjectId | string, res: Response) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const token = jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "15d" });

  // If you're on plain HTTP (no TLS), cookie must NOT be Secure and SameSite should be 'lax'.
  // If you're on HTTPS, set Secure=true and SameSite='none' so it works cross-site.
  const isHttps = String(process.env.USE_HTTPS || '').toLowerCase() === 'true';
  const cookieDomain = process.env.COOKIE_DOMAIN; // optional

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax'),
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    path: '/',
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateJWT_Token;