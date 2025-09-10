"use client";
import { useEffect, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import useAuthStore from "@/zustand/useAuthStore";
import axios from "axios";
import useUserStore from "@/zustand/useUserStore";
import ChatLayout from "@/components/chat/chat-layout";
import useChatStore from "@/zustand/useChatStore";

type NewMessage = { _id: string; conversation: string; sender: string; text?: string; createdAt?: string; status?: 'sent' | 'delivered' | 'read'; participants?: string[] }
type MessageStatus = { _id: string; status: 'sent' | 'delivered' | 'read' }

export default function ChatApp() {
  const { authUser } = useAuthStore();
  const { updateUsers, setUserOnline } = useUserStore();
  const { setSocket } = useChatStore();

  const getUsers = useCallback(async () => {
    try {
      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000";
      const response = await axios.get(`${authBase}/api/v1/users`, { withCredentials: true });
      updateUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, [updateUsers])

  useEffect(() => {
    if (!authUser) return;
    let socketInstance: Socket | null = null;
    let mounted = true;

    const init = async () => {
      try {
        await getUsers();
        if (!mounted) return;
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        // Send JWT in auth payload for socket authentication
        socketInstance = io(socketUrl, {
          auth: { token: authUser?.token },
          withCredentials: true,
        });
        setSocket(socketInstance);

        const onNewMessage = (msg: NewMessage) => {
          const { upsertMessage, activeConversationId } = useChatStore.getState();
          const { users } = useUserStore.getState();
          upsertMessage({
            id: String(msg._id),
            conversationId: String(msg.conversation),
            senderId: String(msg.sender),
            text: msg.text ?? "",
            createdAt: msg.createdAt,
            status: msg.status,
          });
          const me = users.find(u => u.username === authUser?.username)?._id;
          if (me && String(msg.sender) !== String(me)) {
            socketInstance?.emit('message_delivered', { messageId: msg._id });
            if (activeConversationId && String(activeConversationId) === String(msg.conversation)) {
              socketInstance?.emit('message_read', { messageId: msg._id });
            }
          }
        };

        const onMessageStatus = (msg: MessageStatus) => {
          const { updateMessageStatus } = useChatStore.getState();
          updateMessageStatus(String(msg._id), msg.status);
        };

        const onPresenceUpdate = (p: { userId: string; status: 'online' | 'offline' }) => {
          setUserOnline(p.userId, p.status === 'online');
        }

        socketInstance.on("new_message", onNewMessage);
        socketInstance.on("message_status", onMessageStatus);
        socketInstance.on("presence_update", onPresenceUpdate);
        socketInstance.on("connect", () => {
          console.log("🔌 socket connected");
          const { activeConversationId } = useChatStore.getState();
          if (activeConversationId) socketInstance?.emit('join_conversation', activeConversationId)
        })
        socketInstance.on("disconnect", (reason) => {
          console.log("⚠️ socket disconnected:", reason)
        })

        // Initial presence hydration (fetch once after connect)
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          const res = await fetch(`${apiBase}/online-users`, { credentials: 'include' });
          const data = await res.json() as { users?: string[] };
          if (Array.isArray(data.users)) {
            const { users } = useUserStore.getState();
            data.users.forEach(uid => {
              if (users.find(u => u._id === uid)) setUserOnline(uid, true)
            })
          }
        } catch { }
      } catch (e) {
        console.error("Socket init failed:", e);
      }
    };
    init();

    return () => {
      mounted = false;
      if (socketInstance) {
        socketInstance.off("new_message");
        socketInstance.off("message_status");
        socketInstance.off("presence_update");
        socketInstance.off("connect");
        socketInstance.off("disconnect");
        socketInstance.disconnect();
      }
      setSocket(null);
    };
  }, [authUser, getUsers, setSocket, setUserOnline]);

  return <ChatLayout />
}