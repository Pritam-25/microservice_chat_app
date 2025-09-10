"use client"
import type { User } from "@/zustand/useUserStore"
import { useMemo } from "react"
import { User as UserIcon, Users as UsersIcon } from "lucide-react"

export default function ChatHeader({ activeUser, groupName }: { activeUser: User | null; groupName?: string | null }) {
  const isGroup = !!groupName && !activeUser
  const isOnline = useMemo(() => activeUser?.online ?? null, [activeUser])
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {isGroup ? (
        <>
          <div className="size-8 rounded-full bg-violet-300 text-violet-800 flex items-center justify-center">
            <UsersIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="font-medium">{groupName}</div>
            <div className="text-xs text-muted-foreground">group</div>
          </div>
        </>
      ) : activeUser ? (
        <>
          <div className="relative size-8 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center">
            <UserIcon className="h-4 w-4" />
            {isOnline && <span className="absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full ring-2 ring-white bg-green-500" aria-label="Online" />}
          </div>
          <div className="flex flex-col">
            <div className="font-medium">{activeUser.username}</div>
            <div className="text-xs text-muted-foreground">{isOnline ? "online" : "offline"}</div>
          </div>
        </>
      ) : null}
    </div>
  )
}
