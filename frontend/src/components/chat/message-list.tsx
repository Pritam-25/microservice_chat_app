"use client"
import { useEffect, useMemo, useRef } from "react"
import useAuthStore from "@/zustand/useAuthStore"
import useChatStore from "@/zustand/useChatStore"
import useUserStore from "@/zustand/useUserStore"
import { Check, CheckCheck } from "lucide-react"
import type { User } from "@/zustand/useUserStore"

export default function MessageList({ activeUser }: { activeUser: User | null }) {
  const { authUser } = useAuthStore()
  const { messages, activeConversationId } = useChatStore()
  const { users } = useUserStore()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    if (!activeConversationId) return []
    return messages
      .filter((m) => m.conversationId === activeConversationId)
      .slice()
      .sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : 0
        const bt = b.createdAt ? Date.parse(b.createdAt) : 0
        const aValid = Number.isFinite(at)
        const bValid = Number.isFinite(bt)
        if (aValid && bValid && at !== bt) return at - bt
        if (aValid && !bValid) return -1
        if (!aValid && bValid) return 1
        return (a.id ?? "").localeCompare(b.id ?? "")
      })
  }, [messages, activeConversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [filtered.length])

  const fmtTime = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return "" }
  }

  const Tick = ({ status }: { status?: 'sent' | 'delivered' | 'read' }) => {
    // Simple text ticks; can be replaced by SVG icons
    if (status === 'read') return <CheckCheck className="ml-1 text-blue-400 size-3" />
    if (status === 'delivered') return <CheckCheck className="ml-1 size-3" />
    if (status === 'sent') return <Check className="ml-1 size-3 " />
    return null
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full lg:max-w-[80%] p-4 mx-auto space-y-2">
        {filtered.map((m, i) => {
          const meId = users.find(u => u.username === authUser)?._id
          const mine = meId ? (m.senderId === meId) : false
          const isGroupMode = !activeUser && !!activeConversationId
          const senderUser = users.find(u => u._id === m.senderId)
          const senderName = mine ? "You" : (senderUser?.username || (m.senderId?.slice?.(0, 6) ?? "Unknown"))
          return (
            <div key={m.id ?? `${m.senderId}-${m.createdAt}-${i}`} className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg flex gap-4 px-3 py-2 text-base ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div className="flex-1">
                  {isGroupMode && (
                    <div className={`text-xs font-semibold mb-0.5 ${mine ? 'text-primary-foreground/80' : 'text-foreground/80'}`}>
                      {senderName}
                    </div>
                  )}
                  <div>{m.text}</div>
                </div>
                <div className={`text-[10px] flex items-end  ${mine ? 'text-primary-foreground/80' : 'text-foreground/60'}`}>
                  <div className="flex items-center">
                    <span>{fmtTime(m.createdAt)}</span>
                    {mine && <Tick status={m.status} />}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
