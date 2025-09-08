import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authTokenPayload?: any;
    }
  }
}

const NODE_ENV = process.env.NODE_ENV;
const JWT_SECRET = process.env.JWT_SECRET;

export function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Prefer cookie (frontend uses withCredentials) but also support Authorization: Bearer
    const cookieToken = (req as any).cookies?.jwt as string | undefined;
    const header = req.header("authorization") || req.header("Authorization");
    const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const secret = JWT_SECRET ?? (NODE_ENV === "production" ? undefined : "__dev__secret__change_me__");
    if (!secret) {
      return res.status(500).json({ message: "Server misconfigured: JWT secret missing" });
    }
    const decoded = jwt.verify(token, secret) as any;
    // Common patterns: decoded.sub or decoded.id; fall back to decoded.userId
    const uid = decoded?.sub || decoded?.id || decoded?.userId;
    if (!uid) {
      return res.status(401).json({ message: "Unauthorized: Invalid token payload" });
    }
    req.authUserId = String(uid);
    req.authTokenPayload = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
}

export default verifyAuth;
