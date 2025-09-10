"use client"
import Sidebar from "@/components/chat/sidebar"
import ChatHeader from "@/components/chat/chat-header"
import MessageList from "@/components/chat/message-list"
import MessageInput from "@/components/chat/message-input"
import { useEffect, useMemo, useRef, useState } from "react"
import useUserStore, { User } from "@/zustand/useUserStore"
import useAuthStore from "@/zustand/useAuthStore"
import useChatStore from "@/zustand/useChatStore"
import axios from "axios"
import { getApiUrl } from "@/lib/utils"

type ConversationPreview = {
  id: string
  peerUserId: string
  peerUsername: string
  lastText: string
  lastAt?: string
  unread: number
  isGroup?: boolean
  lastStatus?: 'sent' | 'delivered' | 'read'
  lastSenderId?: string
}

// API DTOs
type ApiUnread = { user: string; count: number }
type ApiLastMessage = { text?: string; createdAt?: string; sender?: string; status?: 'sent' | 'delivered' | 'read' }
type ApiConversation = {
  _id: string
  participants: string[]
  isGroup?: boolean
  name?: string
  unread?: ApiUnread[]
  lastMessage?: ApiLastMessage
}

export default function ChatLayout() {
  const { users } = useUserStore()
  const { authUser } = useAuthStore()
  const [activeUser, setActiveUser] = useState<User | null>(null)
  const { socket, setActiveConversationId, setMessages, conversationsVersion, activeConversationId } = useChatStore()
  const [previews, setPreviews] = useState<ConversationPreview[]>([])
  // Central API base so it's available in all handlers/effects
  const apiBase = getApiUrl()
  console.log(`frontend listening to: ${apiBase}`)

  // If a group is active, derive its display name from previews
  const activeGroupName = useMemo(() => {
    if (activeUser) return null
    if (!activeConversationId) return null
    const p = previews.find(p => p.id === activeConversationId)
    if (p && p.isGroup) return p.peerUsername
    return null
  }, [activeUser, activeConversationId, previews])

  // Exclude self from list if present
  const filteredUsers = useMemo(() => users.filter(u => u.username !== authUser?.username), [users, authUser])

  // Load conversation previews once users are available
  useEffect(() => {
    const run = async () => {
      if (!authUser || users.length === 0) return
      const me = users.find(u => u.username === authUser.username)
      if (!me) return
      try {
        const res = await axios.get(`${apiBase}/api/v1/conversations/${me._id}`, { withCredentials: true })
        const data: ApiConversation[] = Array.isArray(res.data?.conversations) ? res.data.conversations as ApiConversation[] : []
        const mapped: ConversationPreview[] = data.map((c) => {
          const inferredGroup = c.isGroup ?? (!!c.name || (Array.isArray(c.participants) && c.participants.length > 2))
          const peerId = String((c.participants || []).find((p: string) => String(p) !== me._id) || "")
          const peer = users.find(u => u._id === peerId)
          const unreadEntry = (c.unread || []).find((e) => String(e.user) === me._id)
          const lastText = c.lastMessage?.text || ""
          const lastAt = c.lastMessage?.createdAt
          const lastSenderId = c.lastMessage?.sender ? String(c.lastMessage.sender) : undefined
          const lastStatus = c.lastMessage?.status
          return {
            id: String(c._id),
            // For groups, display group name; for 1:1, display peer username
            peerUserId: inferredGroup ? "" : (peer?._id || peerId),
            peerUsername: inferredGroup ? (c.name || "Group") : (peer?.username || peerId),
            lastText,
            lastAt,
            unread: unreadEntry?.count || 0,
            isGroup: !!inferredGroup,
            lastStatus: lastStatus as 'sent' | 'delivered' | 'read' | undefined,
            lastSenderId,
          }
        })
        setPreviews(mapped)
      } catch {
        // silently ignore preview load errors
      }
    }
    run()
  }, [authUser, users, activeUser, conversationsVersion, apiBase])

  // Track last requested pair to avoid duplicate calls
  const lastPairKeyRef = useRef<string | null>(null)

  // When active user changes, create/get 1:1 conversation and join room, then fetch messages
  useEffect(() => {
    let prevConversationId: string | null = null
    const run = async () => {
      if (!activeUser) return
      try {
        // derive current user's id from list
        const me = users.find(u => u.username === authUser?.username)
        if (!me) return
        const pairKey = `${me._id}:${activeUser._id}`
        if (lastPairKeyRef.current === pairKey) {
          // already initialized this pair, skip
          return
        }
        lastPairKeyRef.current = pairKey
        // Create or fetch pair conversation
        const res = await axios.post(
          `${apiBase}/api/v1/conversations/pair`,
          { participants: [me._id, activeUser._id] },
          { withCredentials: true }
        )
        const conversationId: string = res.data?.conversation?._id
        if (!conversationId) return
        prevConversationId = conversationId
        setActiveConversationId(conversationId)
        // join room
        if (socket) socket.emit("join_conversation", conversationId)
        // fetch messages
        const mRes = await axios.get(
          `${apiBase}/api/v1/messages/${conversationId}`,
          { withCredentials: true }
        )
        type ApiMessage = { _id: string; conversation: string; sender: string; receiver?: string; text?: string; createdAt?: string; status?: 'sent' | 'delivered' | 'read' }
        let list: ApiMessage[] = Array.isArray(mRes.data?.data) ? mRes.data.data : []
        // If backend still returns newest-first, normalize to oldest-first
        if (list.length >= 2 && new Date(list[0].createdAt || 0) > new Date(list[1].createdAt || 0)) {
          list = list.slice().reverse()
        }
        const mapped = list.map((m: ApiMessage) => ({
          id: String(m._id),
          conversationId: String(m.conversation),
          senderId: String(m.sender),
          receiverId: m.receiver ? String(m.receiver) : undefined,
          text: m.text ?? "",
          createdAt: m.createdAt,
          status: m.status as 'sent' | 'delivered' | 'read' | undefined,
        }))
        setMessages(mapped)

        // After messages load, emit read for any messages from others
        const meId = me._id
        if (socket) {
          for (const msg of mapped) {
            if (msg.senderId !== meId && msg.status !== 'read') {
              socket.emit('message_read', { messageId: msg.id })
            }
          }
        }
      } catch (e) {
        console.error("Failed to init conversation:", e)
      }
    }
    run()
    return () => {
      // allow re-init of the same pair on future selections
      lastPairKeyRef.current = null
      // leave previous room when switching chats
      if (socket && prevConversationId) socket.emit("leave_conversation", prevConversationId)
    }
  }, [activeUser, users, authUser, socket, setActiveConversationId, setMessages, apiBase])

  // Update previews by recomputing from the entire messages array to avoid double-counting
  useEffect(() => {
    const unsub = useChatStore.subscribe((state) => {
      const msgs = state.messages
      if (!authUser) return
      const me = users.find(u => u.username === authUser?.username)
      if (!me) return
      // Build per-conversation aggregates: last message and unread count
      const activeId = useChatStore.getState().activeConversationId
      type Agg = { last: typeof msgs[number] | null; unread: number }
      const byConvo = new Map<string, Agg>()
      for (const m of msgs) {
        const entry = byConvo.get(m.conversationId) || { last: null, unread: 0 }
        // last message by createdAt or insertion order fallback
        if (!entry.last) entry.last = m
        else {
          const a = entry.last.createdAt ? new Date(entry.last.createdAt).getTime() : 0
          const b = m.createdAt ? new Date(m.createdAt).getTime() : 0
          if (b >= a) entry.last = m
        }
        // unread count: messages from others that are not read
        if (m.senderId !== me._id && m.status !== 'read') entry.unread += 1
        byConvo.set(m.conversationId, entry)
      }

      setPreviews((prev) => {
        const next = prev.slice()
        // Update existing previews
        for (let i = 0; i < next.length; i++) {
          const agg = byConvo.get(next[i].id)
          if (!agg || !agg.last) continue
          next[i] = {
            ...next[i],
            lastText: agg.last.text,
            lastAt: agg.last.createdAt,
            unread: activeId === next[i].id ? 0 : agg.unread,
            lastStatus: agg.last.status as 'sent' | 'delivered' | 'read' | undefined,
            lastSenderId: agg.last.senderId,
          }
        }
        // Add previews for conversations not yet present
        for (const [convoId, agg] of byConvo.entries()) {
          if (!agg.last) continue
          const exists = next.find(p => p.id === convoId)
          if (exists) continue
          const last = agg.last
          const derivedPeerId = last.senderId !== me._id ? last.senderId : (last.receiverId || activeUser?._id || "")
          next.unshift({
            id: convoId,
            peerUserId: derivedPeerId,
            peerUsername: users.find(u => u._id === derivedPeerId)?.username || derivedPeerId,
            lastText: last.text,
            lastAt: last.createdAt,
            unread: activeId === convoId ? 0 : agg.unread,
            lastStatus: last.status as 'sent' | 'delivered' | 'read' | undefined,
            lastSenderId: last.senderId,
          })
        }
        return next
      })
    })
    return () => { unsub() }
  }, [authUser, users, activeUser])

  // Reset unread badge immediately when active conversation changes
  useEffect(() => {
    const lastActiveRef = { current: useChatStore.getState().activeConversationId }
    const unsub = useChatStore.subscribe((state) => {
      const activeId = state.activeConversationId
      if (activeId && lastActiveRef.current !== activeId) {
        lastActiveRef.current = activeId
        setPreviews((prev) => prev.map(p => p.id === activeId ? { ...p, unread: 0 } : p))
      } else if (!activeId && lastActiveRef.current) {
        lastActiveRef.current = null
      }
    })
    return () => { unsub() }
  }, [])

  // Ensure we join / leave conversation socket room when the activeConversationId changes (covers manual changes)
  useEffect(() => {
    if (!socket) return
    const current = activeConversationId
    if (current) socket.emit('join_conversation', current)
    return () => {
      if (current) socket.emit('leave_conversation', current)
    }
  }, [activeConversationId, socket])

  return (
    <div className="h-[100svh] w-full flex">
      {/* Left Sidebar */}
      <aside className="w-full max-w-[400px] border-r-2 ">
        <Sidebar
          users={filteredUsers}
          onSelect={setActiveUser}
          onSelectGroup={async ({ id }) => {
            // selecting a group sets it active and loads its messages
            try {
              setActiveUser(null)
              // leave previous room if different
              const prevId = useChatStore.getState().activeConversationId
              if (socket && prevId && prevId !== id) socket.emit("leave_conversation", prevId)
              setActiveConversationId(id)
              if (socket) socket.emit("join_conversation", id)
              const mRes = await axios.get(
                `${apiBase}/api/v1/messages/${id}`,
                { withCredentials: true }
              )
              type ApiMessage = { _id: string; conversation: string; sender: string; receiver?: string; text?: string; createdAt?: string; status?: 'sent' | 'delivered' | 'read' }
              let list: ApiMessage[] = Array.isArray(mRes.data?.data) ? mRes.data.data : []
              if (list.length >= 2 && new Date(list[0].createdAt || 0) > new Date(list[1].createdAt || 0)) {
                list = list.slice().reverse()
              }
              const me = users.find(u => u.username === authUser?.username)
              const mapped = list.map((m: ApiMessage) => ({
                id: String(m._id),
                conversationId: String(m.conversation),
                senderId: String(m.sender),
                receiverId: m.receiver ? String(m.receiver) : undefined,
                text: m.text ?? "",
                createdAt: m.createdAt,
                // Optimistically mark messages from others as read in the store so unread stays cleared
                status: (me && String(m.sender) !== String(me._id)) ? 'read' : (m.status as 'sent' | 'delivered' | 'read' | undefined),
              }))
              setMessages(mapped)

              // Mark messages from others as read for this group, mirroring 1:1 logic
              if (me && socket) {
                for (const msg of mapped) {
                  if (msg.senderId !== me._id) {
                    socket.emit('message_read', { messageId: msg.id })
                  }
                }
              }
              // Persist 0 unread for this group preview immediately
              setPreviews(prev => prev.map(p => p.id === id ? { ...p, unread: 0 } : p))
            } catch (e) {
              console.error("Failed to open group", e)
            }
          }}
          activeUserId={activeUser?._id}
          activeConversationId={activeConversationId}
          previews={previews}
        />
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col">
        {activeUser || activeConversationId ? (
          <>
            <div className="rounded-none border-0 bg-sidebar border-b h-16 flex items-center">
              <ChatHeader activeUser={activeUser} groupName={activeUser ? null : activeGroupName} />
            </div>
            <div className="flex-1 min-h-0">
              <MessageList activeUser={activeUser} />
            </div>
            <div className="border-t">
              <MessageInput activeUser={activeUser} />
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Select a chat to start messaging</div>
          </div>
        )}
      </main>
    </div>
  )
}
