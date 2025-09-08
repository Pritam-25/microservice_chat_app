import { z } from "zod";

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[@$#!%*~?&/\\(){}[\]]/, "Password must contain at least one special character");

export const signupSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters long"),
  email: z.email("Invalid email address").trim(),
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email("Invalid email").trim(),
  password: z.string().nonempty("Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>


export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmNewPassword: z.string().nonempty("Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>


export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email").trim(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>