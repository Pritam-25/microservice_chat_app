import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";  // loads .env automatically
import authRouter from "@/api/v1/routes/auth.route.js";
import userRouter from "@/api/v1/routes/user.route.js";
import verifyToken from "@/middleware/verifyToken.js";
import User from "@/models/user.js";
import type { JwtPayload } from "jsonwebtoken";
import connectDB from "@/config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";


const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"], // frontend origin
  credentials: true, // to allow cookies from frontend
}));

connectDB();

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

// Authenticated user info endpoint
app.get("/api/v1/auth/me", verifyToken, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as JwtPayload | undefined;
    const userId = decoded && typeof decoded === 'object' ? (decoded as any).userId : undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("username email _id");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user: { _id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    console.error("/api/v1/auth/me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("🚀 Hello from Auth Backend");
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
