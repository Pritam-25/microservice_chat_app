import fs from 'fs'
import path from 'path'
import Redis, { RedisOptions } from 'ioredis'

/**
 * Redis / Valkey connection helper (simplified to require REDIS_URL only).
 * Set REDIS_URL, e.g.:
 *   rediss://username:password@host:port
 * If you have a CA cert, you may also provide REDIS_CA_CERT or REDIS_CA_CERT_PATH.
 */

const REDIS_URL = process.env.REDIS_URL 
if (!REDIS_URL) {
  throw new Error('REDIS_URL is required (e.g. rediss://user:pass@host:port)')
}

// If a DB index is appended in the URL (?db=1) ioredis will honor it; we keep optional REDIS_DB override.
const REDIS_DB = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined

let caCert: string | undefined
if (process.env.REDIS_CA_CERT) {
  caCert = process.env.REDIS_CA_CERT
} else if (process.env.REDIS_CA_CERT_PATH) {
  const p = path.resolve(process.env.REDIS_CA_CERT_PATH)
  if (fs.existsSync(p)) {
    try { caCert = fs.readFileSync(p, 'utf8') } catch { }
  }
}

const baseOpts: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 5,
  enableAutoPipelining: true,
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT || 15000),
  db: REDIS_DB,
}

// If scheme is rediss:// TLS is automatic; only attach custom CA or disable validation if user supplied one.
if (REDIS_URL.startsWith('rediss://')) {
  baseOpts.tls = caCert ? { ca: caCert } : baseOpts.tls
}

function createClient(label: string) {
  const client = new Redis(REDIS_URL as string, baseOpts)
  client.on('error', (e: Error) => console.error(`❌ Redis ${label} error:`, e.message))
  client.on('reconnecting', () => console.warn(`↻ Redis ${label} reconnecting...`))
  client.on('end', () => console.warn(`⛔ Redis ${label} connection closed`))
  client.on('connect', () => console.log(`✅ Redis ${label} connected`))
  return client
}

// Separate connections for pub & sub (subscriber connection blocks when subscribed)
export const pub = createClient('publisher')
export const sub = createClient('subscriber')

/** Explicit connect helper (optional). Safe to call multiple times. */
export async function connectRedis() {
  try {
    await Promise.allSettled([pub.status === 'ready' ? Promise.resolve() : pub.connect(), sub.status === 'ready' ? Promise.resolve() : sub.connect()])
  } catch (e) {
    console.error('❌ Initial Redis connect failed', e)
  }
}

// Central channels
export const CHANNELS = {
  NEW_MESSAGE: 'chat:new_message',
  MESSAGE_STATUS: 'chat:message_status',
  PRESENCE: 'chat:presence',
} as const

export type Channel = typeof CHANNELS[keyof typeof CHANNELS]

// Publish helpers
export async function publishNewMessage(payload: unknown) {
  try {
    const p: any = payload as any
    console.log(`🔊 PUB new_message id=${p?._id || ''} convo=${p?.conversation || ''} participants=${Array.isArray(p?.participants) ? p.participants.length : ''}`)
  } catch { }
  return pub.publish(CHANNELS.NEW_MESSAGE, JSON.stringify(payload))
}
export async function publishMessageStatus(payload: unknown) {
  try {
    const p: any = payload as any
    console.log(`🔊 PUB message_status id=${p?._id || ''} status=${p?.status || ''} convo=${p?.conversation || ''}`)
  } catch { }
  return pub.publish(CHANNELS.MESSAGE_STATUS, JSON.stringify(payload))
}
export async function publishPresence(payload: unknown) {
  return pub.publish(CHANNELS.PRESENCE, JSON.stringify(payload))
}

// Subscription wiring
let subscriptionsInitialized = false
export async function initSubscriptions(handlers: Partial<Record<Channel, (data: any) => void>>) {
  if (subscriptionsInitialized) return
  await connectRedis()
  const channelList = Object.values(CHANNELS)
  await sub.subscribe(...channelList)
  sub.on('message', (channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message)
      if (channel === CHANNELS.NEW_MESSAGE) {
        console.log(`📥 SUB new_message id=${parsed?._id || ''} convo=${parsed?.conversation || ''} participants=${Array.isArray(parsed?.participants) ? parsed.participants.length : ''}`)
      } else if (channel === CHANNELS.MESSAGE_STATUS) {
        console.log(`📥 SUB message_status id=${parsed?._id || ''} status=${parsed?.status || ''} convo=${parsed?.conversation || ''}`)
      }
      const h = handlers[channel as Channel]
      if (h) h(parsed)
    } catch (e) {
      console.error('❌ Failed to handle pub/sub message', channel, e)
    }
  })
  console.log('✅ Subscribed to Redis channels:', channelList.join(', '))
  subscriptionsInitialized = true
}

export async function shutdownRedis() {
  try { await pub.quit() } catch { }
  try { await sub.quit() } catch { }
}

