import { z } from "zod";
import { zId } from "./common.js";

// Accept either explicit userA/userB or participants array of exactly 2
export const CreatePairBodySchema = z.union([
  z
    .object({ userA: zId(), userB: zId() })
    .strict()
    .refine((d) => String(d.userA) !== String(d.userB), {
      path: ["userB"],
      message: "userA and userB must be different",
    }),
  z
    .object({
      participants: z
        .array(zId())
        .length(2)
        .refine((arr) => new Set(arr.map(String)).size === 2, {
          path: ["participants"],
          message: "Participants must be two distinct users",
        }),
    })
    .strict(),
]);



export const CreateGroupBodySchema = z
  .object({
    name: z.string().min(1, "Group name is required"),
    participants: z.array(zId()).min(2, "At least 2 participants required"),
    admins: z.array(zId()).optional(),
    avatarUrl: z.url().optional(),
    // createdBy: accept a single id or a single-element array; reject multi-element arrays
    createdBy: z.union([
      zId(),
      z.array(zId()).length(1, "createdBy must be a single value").transform(([id]) => id),
    ]),
  })
  .strict()
  .superRefine((data, ctx) => {
    // participants must be unique
    const pSet = new Set(data.participants.map(String))
    if (pSet.size !== data.participants.length) {
      ctx.addIssue({ code: "custom", path: ["participants"], message: "Participants must be unique" })
    }
    // createdBy must be part of participants
    if (!pSet.has(String(data.createdBy))) {
      ctx.addIssue({ code: "custom", path: ["createdBy"], message: "createdBy must be included in participants" })
    }
    if (data.admins && data.admins.some((a) => !pSet.has(String(a)))) {
      ctx.addIssue({
        code: "custom",
        message: "All admins must be included in participants",
        path: ["admins"],
      });
    }
    // admins must be unique
    if (data.admins) {
      const aSet = new Set(data.admins.map(String))
      if (aSet.size !== data.admins.length) {
        ctx.addIssue({ code: "custom", path: ["admins"], message: "Admins must be unique" })
      }
    }
  });

export const GetUserConversationsParamsSchema = z.object({ userId: zId() }).strict();
