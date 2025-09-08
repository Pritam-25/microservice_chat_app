import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[@$#!%*~?&/\\(){}[\]]/, "Password must contain at least one special character");
