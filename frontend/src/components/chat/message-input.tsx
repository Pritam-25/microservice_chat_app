"use client"
import { useState, type FormEvent } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { User } from "@/zustand/useUserStore"
import useAuthStore from "@/zustand/useAuthStore"
import useChatStore from "@/zustand/useChatStore"

export default function MessageInput({ activeUser }: { activeUser: User | null }) {
  const [value, setValue] = useState("")
  const { authUser } = useAuthStore()
  const { socket, activeConversationId } = useChatStore()

  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value.trim() || !authUser || !activeConversationId) return

    if (socket) {
      socket.emit('send_message', {
        conversation: activeConversationId,
        type: 'text',
        text: value,
      })
      setValue("")
    }
  }

  return (
    <form onSubmit={send} className="p-3 flex items-center gap-2 bg-sidebar">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={activeConversationId ? (activeUser ? `Message ${activeUser.username}` : "Message group") : "Select a chat to start"}
        disabled={!activeConversationId}
      />
      <Button type="submit" disabled={!activeConversationId || !value.trim()}>Send</Button>
    </form>
  )
}
