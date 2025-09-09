import type { Server, Socket } from "socket.io"
import jwt from "jsonwebtoken"
import { parse as parseCookie } from "cookie"

export function registerSocketAuth(io: Server) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  io.use((socket: Socket, next) => {
    try {
      // 1. Try to get token from httpOnly cookie
      const cookies = parseCookie(socket.request.headers.cookie || "")
      const cookieToken = cookies["jwt"]

      // 2. Or from socket handshake auth
      const authToken = (socket.handshake.auth as any)?.token as string | undefined
      const token = cookieToken || authToken

      // Choose one
      if (!token) return next(new Error("Unauthorized: No token"))

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as any

      // Extracted userId from token payload
      const uid = decoded?.sub || decoded?.id || decoded?.userId
      if (!uid) return next(new Error("Unauthorized: Invalid token payload"));

      // Attach to socket object for future handlers
      (socket as any).data = {
        ...(socket as any).data,
        userId: String(uid),
        tokenDecoded: decoded
      }
      return next()
    } catch (err) {
      return next(new Error("Unauthorized: Invalid or expired token"))
    }
  })
}
