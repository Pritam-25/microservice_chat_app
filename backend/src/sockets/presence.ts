const onlineUserSockets = new Map<string, Set<string>>() // userId -> socketIds

export function addOnlineUser(userId: string, socketId: string) {
  const set = onlineUserSockets.get(userId) || new Set<string>()
  set.add(socketId)
  onlineUserSockets.set(userId, set)
}

export function removeOnlineUser(userId: string, socketId: string) {
  const set = onlineUserSockets.get(userId)
  if (!set) return
  set.delete(socketId)
  if (set.size === 0) onlineUserSockets.delete(userId)
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUserSockets.keys())
}

export function isUserOnline(userId: string): boolean {
  return onlineUserSockets.has(userId)
}
