import { publishPresence } from "@/redis/messagePubSub.js";
import { pub as redis } from "@/redis/messagePubSub.js";

// In-memory map (per-instance) of userId -> socketIds
const onlineUserSockets = new Map<string, Set<string>>()

// Redis key patterns
const COUNTER_KEY = (uid: string) => `presence:user:${uid}:count`
const HB_KEY = (uid: string) => `presence:user:${uid}:hb`
const ONLINE_SET_KEY = 'presence:online:users'

// Configurable timings
const HEARTBEAT_INTERVAL_MS = Number(process.env.PRESENCE_HEARTBEAT_INTERVAL_MS || 15_000)
const HEARTBEAT_TTL_SEC = Number(process.env.PRESENCE_HEARTBEAT_TTL_SEC || 45)
const CLEANUP_INTERVAL_MS = Number(process.env.PRESENCE_CLEANUP_INTERVAL_MS || 60_000)

let heartbeatTimer: NodeJS.Timeout | null = null
let cleanupTimer: NodeJS.Timeout | null = null

export async function addOnlineUser(userId: string, socketId: string) {
  const set = onlineUserSockets.get(userId) || new Set<string>()
  set.add(socketId)
  onlineUserSockets.set(userId, set)

  // Increment distributed counter
  try {
    const newCount = await redis.incr(COUNTER_KEY(userId))
    if (newCount === 1) {
      // first active socket globally -> mark online
      await redis.sadd(ONLINE_SET_KEY, userId)
      publishPresence({ userId, action: 'online', at: Date.now() }).catch(() => { })
    }
    // set / refresh heartbeat key
    await redis.set(HB_KEY(userId), '1', 'EX', HEARTBEAT_TTL_SEC)
  } catch (e) {
    console.error('❌ presence addOnlineUser redis error', e)
  }
  startPresenceLoops()
}

export async function removeOnlineUser(userId: string, socketId: string) {
  const set = onlineUserSockets.get(userId)
  if (!set) return
  set.delete(socketId)
  if (set.size === 0) onlineUserSockets.delete(userId)

  try {
    const newCount = await redis.decr(COUNTER_KEY(userId))
    if (newCount <= 0) {
      await redis.del(COUNTER_KEY(userId))
      await redis.srem(ONLINE_SET_KEY, userId)
      publishPresence({ userId, action: 'offline', at: Date.now() }).catch(() => { })
    }
  } catch (e) {
    console.error('❌ presence removeOnlineUser redis error', e)
  }
}

// Heartbeat renewal for every locally tracked user
async function renewHeartbeats() {
  const users = Array.from(onlineUserSockets.keys())
  if (users.length === 0) return
  try {
    const pipeline = redis.pipeline()
    for (const u of users) pipeline.set(HB_KEY(u), '1', 'EX', HEARTBEAT_TTL_SEC)
    await pipeline.exec()
  } catch (e) { console.error('❌ presence heartbeat error', e) }
}

// Cleanup stale users: if heartbeat key missing but count > 0, decrement & possibly mark offline
async function cleanupStale() {
  try {
    const userIds = await redis.smembers(ONLINE_SET_KEY)
    if (!userIds.length) return
    const pipeline = redis.pipeline()
    for (const u of userIds) pipeline.exists(HB_KEY(u))
    const results = await pipeline.exec()
    if (!results) return
    for (let i = 0; i < userIds.length; i++) {
      const u = userIds[i]
      const exists = (results[i][1] as number) === 1
      if (!exists) {
        // Heartbeat expired; force counter to 0
        await redis.del(COUNTER_KEY(u))
        await redis.srem(ONLINE_SET_KEY, u)
        publishPresence({ userId: u, action: 'offline', at: Date.now(), stale: true }).catch(() => { })
      }
    }
  } catch (e) { console.error('❌ presence cleanup error', e) }
}

function startPresenceLoops() {
  if (!heartbeatTimer) heartbeatTimer = setInterval(renewHeartbeats, HEARTBEAT_INTERVAL_MS)
  if (!cleanupTimer) cleanupTimer = setInterval(cleanupStale, CLEANUP_INTERVAL_MS)
}

export function stopPresenceLoops() {
  if (heartbeatTimer) clearInterval(heartbeatTimer); heartbeatTimer = null
  if (cleanupTimer) clearInterval(cleanupTimer); cleanupTimer = null
}

// Local fast path (per-instance)
export function getOnlineUserIds(): string[] {
  return Array.from(onlineUserSockets.keys())
}

export function isUserOnline(userId: string): boolean {
  return onlineUserSockets.has(userId)
}

// Global query (reads Redis set)
export async function getGlobalOnlineUsers(): Promise<string[]> {
  try { return await redis.smembers(ONLINE_SET_KEY) } catch { return [] }
}
