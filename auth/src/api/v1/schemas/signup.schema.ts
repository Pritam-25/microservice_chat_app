import { z } from "zod";
import { passwordSchema } from "./password.schema.js";

export const signupSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters long"),
  email: z.email("Invalid email address").trim(),
  password: passwordSchema,
});