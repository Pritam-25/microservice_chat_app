// backend/src/middleware/ensureSameUserParam.ts
import type { Request, Response, NextFunction } from "express";

export default function ensureSameUserParam(param: string = "userId") {
  // Narrow Request to include authUserId injected by verifyAuth middleware
  return (req: Request & { authUserId?: string }, res: Response, next: NextFunction) => {
    const authId = req.authUserId;
    const paramVal = req.params?.[param];
    if (!authId || String(authId) !== String(paramVal)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}