import { z } from "zod";
import { zId } from "@zodyac/zod-mongoose";



export const MessageTypeEnum = z.enum(["text", "image", "file"]);
export const MessageStatusEnum = z.enum(["sent", "delivered", "read"]);

export const AttachmentSchema = z.object({
  url: z.url(),
  mimeType: z.string(),
  size: z.number().optional(),
  name: z.string().optional(),
});

export const MessageSchema = z
  .object({
    conversation: zId(),
    sender: zId(),
    receiver: zId().optional(),
    type: MessageTypeEnum.default("text"),
    text: z.string().trim().min(1).optional(),
    attachments: z.array(AttachmentSchema).default([]),
    status: MessageStatusEnum.default("sent"),
    deliveredAt: z.coerce.date().optional(),
    readAt: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    const hasText = typeof data.text === "string" && data.text.trim().length > 0
    const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0
    if (!hasText && !hasAttachments) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Either non-empty text or at least one attachment is required.", path: ["text"] })
    }
    if (data.type !== "text" && !hasAttachments) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Non-text messages require at least one attachment.", path: ["attachments"] })
    }
    if (data.status === "delivered" && !data.deliveredAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deliveredAt is required when status is delivered.", path: ["deliveredAt"] })
    }
    if (data.status === "read") {
      if (!data.readAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "readAt is required when status is read.", path: ["readAt"] })
      }
      if (!data.deliveredAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deliveredAt is required when status is read.", path: ["deliveredAt"] })
      }
      if (data.deliveredAt && data.readAt && data.readAt < data.deliveredAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "readAt cannot be before deliveredAt.", path: ["readAt"] })
      }
    }
  })
  .strict()


export type IMessageInput = z.infer<typeof MessageSchema>;