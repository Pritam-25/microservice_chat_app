"use client"
import type { User } from "@/zustand/useUserStore"
import { useEffect, useMemo, useState } from "react"
import { User as UserIcon, Users as UsersIcon } from "lucide-react"

export default function ChatHeader({ activeUser, groupName }: { activeUser: User | null; groupName?: string | null }) {
  const isGroup = !!groupName && !activeUser
  const [isOnline, setIsOnline] = useState<boolean | null>(null)

  const activeUserId = useMemo(() => activeUser?._id ?? null, [activeUser])

  useEffect(() => {
    if (!activeUserId) {
      setIsOnline(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await fetch("http://localhost:4000/online-users", {
          credentials: "include",
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { users?: string[] }
        if (!cancelled) setIsOnline(!!data?.users?.includes(activeUserId))
      } catch {
        // ignore network errors; keep last known state
      }
    }
    load()
    const int = setInterval(load, 30000)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(int)
    }
  }, [activeUserId])
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
          <div className="size-8 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center">
            <UserIcon className="h-4 w-4" />
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
