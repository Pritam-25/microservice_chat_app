import AuthGuard from "@/components/auth-guard"
import ChatApp from "@/components/chat-component"

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatApp />
    </AuthGuard>
  )
}
