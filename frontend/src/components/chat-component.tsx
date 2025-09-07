"use client";
import { useEffect } from "react";
import io, { Socket } from "socket.io-client";
import useAuthStore from "@/zustand/useAuthStore";
import axios from "axios";
import useUserStore from "@/zustand/useUserStore";
import ChatLayout from "@/components/chat/chat-layout";
import useChatStore from "@/zustand/useChatStore";

type NewMessage = { _id: string; conversation: string; sender: string; text?: string; createdAt?: string; status?: 'sent' | 'delivered' | 'read' }
type MessageStatus = { _id: string; status: 'sent' | 'delivered' | 'read' }

export default function ChatApp() {
  const { authUser } = useAuthStore();
  const { updateUsers } = useUserStore();
  const { setSocket } = useChatStore();

  const getUsers = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/v1/users", { withCredentials: true });
      updateUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      // Load users first so we can compute `me` reliably for delivery/read acks
      await getUsers();
      const socketInstance: Socket = io("http://localhost:4000", {
        withCredentials: true,
      });
      setSocket(socketInstance)

      // Listen for conversation room broadcasts and self-acks
      socketInstance.on("new_message", (msg: NewMessage) => {
        // Use latest store state to avoid stale closures
        const { upsertMessage } = useChatStore.getState()
        const { users } = useUserStore.getState()
        const { activeConversationId } = useChatStore.getState()

        upsertMessage({
          id: String(msg._id),
          conversationId: String(msg.conversation),
          senderId: String(msg.sender),
          text: msg.text ?? "",
          createdAt: msg.createdAt,
          status: msg.status,
        })

        // If message is from others, acknowledge delivery/read
        const me = users.find(u => u.username === authUser)?._id
        if (me && String(msg.sender) !== String(me)) {
          socketInstance.emit('message_delivered', { messageId: msg._id })
          if (activeConversationId && String(activeConversationId) === String(msg.conversation)) {
            socketInstance.emit('message_read', { messageId: msg._id })
          }
        }

        // Note: previews recompute from store messages; no direct sidebar state changes here
      })

      // Listen for status updates
      socketInstance.on("message_status", (msg: MessageStatus) => {
        const { updateMessageStatus } = useChatStore.getState()
        updateMessageStatus(String(msg._id), msg.status)
      })

      return () => {
        socketInstance.off("new_message");
        socketInstance.off("message_status");
        socketInstance.disconnect();
        setSocket(null)
      };
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  return <ChatLayout />
}