import { z } from "zod";
import { passwordSchema } from "./password.schema.js";

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmNewPassword: z.string().nonempty("Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
});