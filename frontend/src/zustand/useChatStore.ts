import { create } from "zustand"
import type { Socket } from "socket.io-client"

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  receiverId?: string
  text: string
  status?: 'sent' | 'delivered' | 'read'
  createdAt?: string
}

type ChatStore = {
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  messages: ChatMessage[]
  setMessages: (msgs: ChatMessage[]) => void
  upsertMessage: (m: ChatMessage) => void
  updateMessageStatus: (id: string, status: 'sent' | 'delivered' | 'read') => void
  socket: Socket | null
  setSocket: (s: Socket | null) => void
  conversationsVersion: number
  bumpConversationsVersion: () => void
}

const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  upsertMessage: (m) => set((state) => {
    const idx = state.messages.findIndex(x => x.id === m.id)
    if (idx >= 0) {
      const copy = state.messages.slice()
      copy[idx] = { ...copy[idx], ...m }
      return { messages: copy }
    }
    return { messages: [...state.messages, m] }
  }),
  updateMessageStatus: (id, status) => set((state) => {
    const idx = state.messages.findIndex(x => x.id === id)
    if (idx === -1) return {}
    const copy = state.messages.slice()
    copy[idx] = { ...copy[idx], status }
    return { messages: copy }
  }),
  socket: null,
  setSocket: (s) => set({ socket: s }),
  conversationsVersion: 0,
  bumpConversationsVersion: () => set((s) => ({ conversationsVersion: s.conversationsVersion + 1 })),
}))

export default useChatStore