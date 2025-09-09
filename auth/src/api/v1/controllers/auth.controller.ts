import User from "@/models/user.js";
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { signupSchema, loginSchema, resetPasswordSchema, forgotPasswordSchema } from "@/api/v1/schemas/index.js";
import { ZodError } from "zod";
import { generateJWT_Token } from "@/utils/generateToken.js";
import crypto from "crypto";
import { sendEmail } from "@/utils/sendEmail.js";

const signup = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = signupSchema.parse(req.body);

    const { username, email, password } = validatedData;
    // Normalize input to avoid case / whitespace duplicates
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check if user exists (use normalized email)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username: normalizedUsername, email: normalizedEmail, password: hashedPassword });
    await newUser.save();
    generateJWT_Token(newUser._id, res);  // create and send JWT token in cookie

    res.status(201).json({
      message: "User created successfully",
      user: { username: newUser.username, email: newUser.email }
    });

  } catch (error) {
    if ((error as any)?.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export { signup };


// --------------------------Signin controller.ts--------------------------
const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;
    const normalizedEmail = email.trim().toLowerCase();

    // Password is select:false in schema, explicitly include it for verification
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    generateJWT_Token(user._id, res);  // create and send JWT token in cookie
    res.status(200).json({
      message: "Login successful",
      user: { username: user.username, email: user.email, _id: user._id }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
}

export { login };

// --------------------------Signout controller.ts--------------------------

const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};


export { logout };


// --------------------------Forgot Password controller.ts--------------------------
const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "User with this email does not exist" });
    }

    // Generate reset token (store hashed version only)
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(rawResetToken)
      .digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Build frontend base URL from env (fallback to localhost)
    const baseUrl = process.env.FRONTEND_URL || process.env.APP_ORIGIN || "http://localhost:3000";
    const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password/${rawResetToken}`;

    // Send email (contains raw token)
    const html = `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click below link to reset:</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
      <p>This link will expire in 10 minutes.</p>
    `;

    await sendEmail(user.email, "Password Reset Request", html);

    res.status(200).json({ message: "Password reset link sent to email" });

  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

export { forgotPassword };

// --------------------------Reset Password controller.ts--------------------------
const resetPassword = async (req: Request, res: Response) => {
  try {
    // token comes from URL param
    const { token } = req.params; // raw token from link

    // validate newPassword + confirmPassword from body
    const { newPassword, confirmNewPassword } = resetPasswordSchema.parse(req.body);

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.issues,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export { resetPassword };