"use client"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import type { User } from "@/zustand/useUserStore"
import { LogOut, Menu, PenBox, Users, Loader2, User as UserIcon, Check, CheckCheck } from "lucide-react"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import axios from "axios"
import useAuthStore from "@/zustand/useAuthStore"
import useUserStore from "@/zustand/useUserStore"
import useChatStore from "@/zustand/useChatStore"
import { toast } from "sonner"

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

type Props = {
  users: User[]
  onSelect: (u: User) => void
  onSelectGroup?: (c: { id: string; name: string }) => void
  activeUserId?: string
  activeConversationId?: string | null
  previews?: ConversationPreview[]
}

export default function Sidebar({ users, onSelect, onSelectGroup, activeUserId, activeConversationId, previews = [] }: Props) {
  const [q, setQ] = useState("")
  const [openCompose, setOpenCompose] = useState(false)
  const [openGroup, setOpenGroup] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const { authUser } = useAuthStore()
  const { users: allUsers } = useUserStore()
  const { bumpConversationsVersion } = useChatStore()
  const meId = useMemo(() => allUsers.find(u => u.username === authUser?.username)?._id, [allUsers, authUser])
  // Visible previews filtered by search (matches group name or peer username)
  const visiblePreviews = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = previews.slice().sort((a, b) => {
      const at = a.lastAt ? Date.parse(a.lastAt) : 0
      const bt = b.lastAt ? Date.parse(b.lastAt) : 0
      return bt - at
    })
    if (!s) return list
    return list.filter(p => (p.peerUsername || "").toLowerCase().includes(s))
  }, [previews, q])

  return (
    <div className="flex h-full flex-col bg-sidebar pl-2">
      <div className="h-16 flex items-center justify-between ">
        <div className="px-4">
          <h2 className="text-xl font-bold">Chats</h2>
        </div>
        <div className="px-4 flex items-center gap-2">
          <Button variant={"ghost"} onClick={() => setOpenCompose(true)} aria-label="New chat">
            <PenBox className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={"ghost"} aria-label="Menu">
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpenGroup(true)} className="gap-2">
                <Users className="size-4" />
                <span>Create group chat</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-red-600 focus:text-red-600"
                onClick={async () => {
                  try {
                    const authBase = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000"
                    await axios.post(`${authBase}/api/v1/auth/logout`, {}, { withCredentials: true })
                    // Basic client sign-out: clear authUser; in a full app, also redirect to login
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    authUser && console.log("Logged out:", authUser.username)
                    window.location.href = "/login"
                  } catch (e) {
                    console.error("Logout failed", e)
                  }
                }}
              >
                <LogOut className="size-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-3">
        <Input placeholder="Search or start new chat" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pt-3">
        <ul>
          {visiblePreviews.map((pv) => {
            const isGroup = pv.isGroup === true
            if (isGroup) {
              const isActive = activeConversationId === pv.id
              const rawSenderName = pv.lastSenderId ? (allUsers.find(u => u._id === pv.lastSenderId)?.username || pv.lastSenderId.slice(0, 6)) : undefined
              const displaySender = pv.lastSenderId && pv.lastSenderId === meId ? "You" : rawSenderName
              const fmtTime = (iso?: string) => {
                if (!iso) return ""
                try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return "" }
              }
              const Tick = () => {
                if (pv.lastSenderId !== meId) return null
                if (pv.lastStatus === 'read') return <CheckCheck className="size-3 text-blue-500" />
                if (pv.lastStatus === 'delivered') return <CheckCheck className="size-3" />
                if (pv.lastStatus === 'sent') return <Check className="size-3" />
                return null
              }
              return (
                <li key={pv.id}>
                  <button
                    type="button"
                    onClick={() => onSelectGroup?.({ id: pv.id, name: pv.peerUsername })}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-sidebar-accent rounded-sm",
                      isActive && "bg-blue-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full border-2 shrink-0 flex items-center justify-center bg-violet-50 text-violet-700">
                        <Users className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">{pv.peerUsername}</div>
                          {pv.unread > 0 && (
                            <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] px-1">
                              {pv.unread}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-end justify-between gap-2">
                          <span className="truncate">
                            {displaySender ? (<><span className="font-medium">{displaySender}</span>: {pv.lastText || ""}</>) : (pv.lastText || "")}
                          </span>
                          <span className="shrink-0 inline-flex items-center gap-1">
                            <span>{fmtTime(pv.lastAt)}</span>
                            <Tick />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              )
            }
            // 1:1 chat preview
            const u = users.find(x => x._id === pv.peerUserId)
            if (!u) return null
            const fmtTime = (iso?: string) => {
              if (!iso) return ""
              try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return "" }
            }
            const Tick = () => {
              if (pv.lastSenderId !== meId) return null
              if (pv.lastStatus === 'read') return <CheckCheck className="size-3 text-blue-500" />
              if (pv.lastStatus === 'delivered') return <CheckCheck className="size-3" />
              if (pv.lastStatus === 'sent') return <Check className="size-3" />
              return null
            }
            return (
              <li key={pv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-sidebar-accent rounded-sm",
                    activeUserId === u._id && "bg-blue-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 rounded-full border-2 shrink-0 flex items-center justify-center bg-blue-50 text-blue-700">
                      <UserIcon className="size-5" />
                      {u.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 block size-3 rounded-full ring-2 ring-white bg-green-500" aria-label="Online" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{u.username}</div>
                        {pv.unread > 0 && (
                          <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] px-1">
                            {pv.unread}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-end justify-between gap-2">
                        <span className="truncate">{pv.lastText || ""}</span>
                        <span className="shrink-0 inline-flex items-center gap-1">
                          <span>{fmtTime(pv.lastAt)}</span>
                          <Tick />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Compose: searchable user picker */}
      <CommandDialog open={openCompose} onOpenChange={setOpenCompose} title="Start a new chat" description="Search users to start chatting">
        <CommandInput placeholder="Search users..." />
        <CommandList>
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup heading="Users">
            {users.map((u) => (
              <CommandItem
                key={u._id}
                onSelect={() => {
                  setOpenCompose(false)
                  onSelect(u)
                }}
              >
                <div className="relative size-8 rounded-full bg-blue-100 border-2 mr-2">
                  {u.online && <span className="absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full ring-2 ring-white bg-green-500" aria-label="Online" />}
                </div>
                <span className="truncate">{u.username}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Group create: searchable multi-select picker with Create/Cancel */}
      <CommandDialog
        open={openGroup}
        onOpenChange={(open) => {
          setOpenGroup(open)
          if (!open) {
            setSelectedIds([])
            setGroupName("")
            setIsCreating(false)
          }
        }}
        title="Create a group chat"
        description="Search and select users to include in the group"
      >
        <div className="px-3 py-2 space-y-2">
          <Input
            placeholder="Group name (required)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        <CommandInput placeholder="Search users..." />
        <CommandList>
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup heading="Users">
            {users.map((u) => {
              const checked = selectedIds.includes(u._id)
              return (
                <CommandItem
                  key={u._id}
                  onSelect={(val) => {
                    // Prevent closing dialog on select; toggling handled by checkbox container
                    if (val) return
                  }}
                >
                  <div
                    className="mr-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIds((prev) =>
                        prev.includes(u._id)
                          ? prev.filter((id) => id !== u._id)
                          : [...prev, u._id]
                      )
                    }}
                  >
                    <Checkbox checked={checked} aria-label={`Select ${u.username}`} />
                  </div>
                  <div className="size-8 rounded-full bg-blue-100 border-2 mr-2" />
                  <span className="truncate">{u.username}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-end gap-2 border-t p-2 bg-background">
          <Button
            variant="ghost"
            onClick={() => {
              setOpenGroup(false)
              setSelectedIds([])
              setGroupName("")
              setIsCreating(false)
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            disabled={selectedIds.length < 1 || isCreating || groupName.trim().length < 1}
            onClick={async () => {
              if (isCreating) return
              try {
                setIsCreating(true)
                // Find current user id (from global store to ensure we have the auth user record)
                const me = allUsers.find((u) => u.username === authUser?.username)
                if (!me) throw new Error("Current user not found")
                const participants = Array.from(new Set([...selectedIds, me._id]))
                const payload = {
                  name: groupName.trim(),
                  participants,
                  createdBy: me._id,
                }
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
                const res = await axios.post(
                  `${apiBase}/api/v1/conversations/group`,
                  payload,
                  { withCredentials: true }
                )
                const convoId: string | undefined = res.data?.conversation?._id
                const createdName = payload.name
                if (convoId) {
                  toast.success("Group created")
                  // Close and clear state
                  setOpenGroup(false)
                  setSelectedIds([])
                  setGroupName("")
                  // Focus the new group instead of first peer
                  onSelectGroup?.({ id: convoId, name: createdName })
                  // Trigger previews refetch
                  bumpConversationsVersion()
                }
              } catch (e: unknown) {
                console.error("Failed to create group", e)
                let msg = "Failed to create group"
                if (axios.isAxiosError(e)) {
                  const data = e.response?.data as { message?: string } | undefined
                  msg = data?.message || e.message || msg
                } else if (e instanceof Error) {
                  msg = e.message
                }
                toast.error(msg)
              } finally {
                setIsCreating(false)
              }
            }}
          >
            {isCreating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create group"
            )}
          </Button>
        </div>
      </CommandDialog>
    </div>
  )
}
