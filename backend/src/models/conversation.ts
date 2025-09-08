import mongoose, { Schema, Types, Document, Model } from "mongoose"

// ------------------------------------
// Types
// ------------------------------------
export interface IUnread {
  user: Types.ObjectId
  count: number
}

export interface IConversation extends Document {
  isGroup: boolean
  participants: Types.ObjectId[] // [userA, userB] for 1:1 (sorted)
  pKey?: string // stable unique key for 1:1: "<userA>:<userB>"
  gKey?: string // stable unique key for group: "<nameLower>:<id1>:<id2>:..."
  name?: string // group name (if isGroup)
  admins?: Types.ObjectId[] // group admins
  avatarUrl?: string
  lastMessage?: Types.ObjectId // ref Message
  unread: IUnread[] // per-user unread count
  createdAt: Date
  updatedAt: Date
}

interface ConversationModel extends Model<IConversation> {
  getOrCreatePair(userA: Types.ObjectId, userB: Types.ObjectId): Promise<IConversation>
}

// ------------------------------------
// Unread Schema
// ------------------------------------
const UnreadSchema = new Schema<IUnread>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
)

// ------------------------------------
// Conversation Schema
// ------------------------------------
const ConversationSchema = new Schema<IConversation, ConversationModel>(
  {
    isGroup: { type: Boolean, default: false, index: true },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator(this: IConversation, v: Types.ObjectId[]) {
          const unique = new Set(v.map(String))
          if (this.isGroup) return unique.size >= 2
          return unique.size === 2 // 1:1 requires exactly two distinct users
        },
        message: "Participants must be distinct; groups require at least 2",
      }
    },
    pKey: { type: String, index: true, unique: true, sparse: true },
    gKey: { type: String, index: true, unique: true, sparse: true },

    name: { type: String, required: function (this: IConversation) { return this.isGroup } },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    avatarUrl: { type: String },

    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    unread: { type: [UnreadSchema], default: [] },
  },
  { timestamps: true }
)

// ------------------------------------
// Middleware: ensure sorted participants & pKey
// ------------------------------------
ConversationSchema.pre("validate", function (next) {
  if (Array.isArray(this.participants) && this.participants.length >= 2) {
    // Sort participant ids to make keys deterministic
    const ids = this.participants
      .map((id) => id.toString())
      .sort((x, y) => (x < y ? -1 : 1))
    this.participants = ids.map((id) => new Types.ObjectId(id))

    if (!this.isGroup && ids.length === 2) {
      // 1:1 key
      this.pKey = `${ids[0]}:${ids[1]}`
    }

    if (this.isGroup) {
      // Normalize group name and compute unique group key
      const nameLower = (this.name || "").trim().toLowerCase()
      if (nameLower) {
        this.gKey = `${nameLower}:${ids.join(":")}`
      }
    }
  }
  next()
})

// ------------------------------------
// Indexes
// ------------------------------------
ConversationSchema.index({ participants: 1 })
ConversationSchema.index({ updatedAt: -1 })

// ------------------------------------
// Static: getOrCreatePair
// ------------------------------------
ConversationSchema.statics.getOrCreatePair = async function (
  userA: Types.ObjectId,
  userB: Types.ObjectId
) {
  const ids = [userA.toString(), userB.toString()].sort()
  if (ids[0] === ids[1]) {
    throw new Error("Cannot create a 1:1 conversation with the same user")
  }
  const pKey = `${ids[0]}:${ids[1]}`
  const convo = await this.findOneAndUpdate(
    { pKey },
    {
      $setOnInsert: {
        isGroup: false,
        participants: [new Types.ObjectId(ids[0]), new Types.ObjectId(ids[1])],
        unread: [
          { user: new Types.ObjectId(ids[0]), count: 0 },
          { user: new Types.ObjectId(ids[1]), count: 0 },
        ],
      },
    },
    { upsert: true, new: true }
  )
  return convo
}

export const Conversation = mongoose.model<IConversation, ConversationModel>(
  "Conversation",
  ConversationSchema
)
