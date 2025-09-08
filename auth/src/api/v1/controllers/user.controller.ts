import User from "@/models/user.js";
import type { Request, Response } from "express";


const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, 'username');
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default getUsers;