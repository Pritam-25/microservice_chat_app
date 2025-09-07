import mongoose, { Schema, Types, Document } from "mongoose"

// ------------------------------------
// Types
// ------------------------------------
export type MessageType = "text" | "image" | "file"
export type MessageStatus = "sent" | "delivered" | "read"

export interface IAttachment {
  url: string
  mimeType: string
  size?: number
  name?: string
}

export interface IMessage extends Document {
  conversation: Types.ObjectId
  sender: Types.ObjectId
  receiver?: Types.ObjectId // optional (for 1:1 convenience)
  type: MessageType
  text?: string
  attachments?: IAttachment[]
  status: MessageStatus
  deliveredAt?: Date
  readAt?: Date
  readBy?: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

// ------------------------------------
// Attachment Schema
// ------------------------------------
const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: Number,
    name: String,
  },
  { _id: false }
)

// ------------------------------------
// Message Schema
// ------------------------------------
const MessageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }, // optional for 1:1
    type: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    text: {
      type: String,
      trim: true,
      validate: {
        validator: function (this: IMessage, v?: string) {
          if (Array.isArray(this.attachments) && this.attachments.length > 0) return true
          return typeof v === "string" && v.trim().length > 0
        },
        message: "Either non-empty text or at least one attachment is required.",
      },
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
      validate: {
        validator: function (this: IMessage, arr?: IAttachment[]) {
          if (typeof this.text === "string" && this.text.trim().length > 0) return true
          return Array.isArray(arr) && arr.length > 0
        },
        message: "Either non-empty text or at least one attachment is required.",
      },
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deliveredAt: Date,
    readAt: Date,
  },
  { timestamps: true }
)

// ------------------------------------
// Indexes
// ------------------------------------
MessageSchema.index({ conversation: 1, createdAt: -1 }) // newest first in conversation
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 }) // fast 1:1 lookups

export const Message = mongoose.model<IMessage>("Message", MessageSchema)
