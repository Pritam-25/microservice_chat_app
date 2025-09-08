import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Shared Zod helpers to avoid circular imports
export const zId = () =>
  z.string().refine(isValidObjectId, {
    message: "Invalid ObjectId",
  });
