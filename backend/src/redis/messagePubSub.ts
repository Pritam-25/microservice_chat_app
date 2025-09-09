import fs from 'fs'
import path from 'path'
import Redis, { RedisOptions } from 'ioredis'

/**
 * Redis / Valkey connection helper.
 * Supports either discrete host/port env vars OR a full rediss:// URL (Aiven style).
 * Preferred for Aiven: set REDIS_URL=rediss://user:pass@host:port
 * Fallback vars (legacy): REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_TLS
 *
 * Security:
 *  - If you have an Aiven CA cert, set REDIS_CA_CERT (PEM string) OR REDIS_CA_CERT_PATH to a file.
 *  - Otherwise we fall back to `rejectUnauthorized:false` for convenience (not recommended in prod).
 */

const REDIS_URL = process.env.REDIS_URL || process.env.VALKEY_URL || process.env.SERVICE_URI
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)
const REDIS_USERNAME = process.env.REDIS_USERNAME
const REDIS_PASSWORD = process.env.REDIS_PASSWORD
const REDIS_FORCE_TLS = (process.env.REDIS_FORCE_TLS || '').toLowerCase() === 'true'
const REDIS_DB = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined

// Auto-detect TLS if URL is rediss:// or host looks like Aiven *.aivencloud.com
const inferredTLS = !!(REDIS_URL?.startsWith('rediss://') || /\.aivencloud\.com$/i.test(REDIS_HOST) || REDIS_FORCE_TLS)

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
  // Provide a more generous connect timeout for remote TLS endpoints
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT || 15000),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  host: REDIS_HOST,
  port: REDIS_PORT,
}

if (inferredTLS) {
  baseOpts.tls = caCert ? { ca: caCert } : { rejectUnauthorized: false }
}

function createClient(label: string) {
  const client = REDIS_URL ? new Redis(REDIS_URL, baseOpts) : new Redis(baseOpts)
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
  return pub.publish(CHANNELS.NEW_MESSAGE, JSON.stringify(payload))
}
export async function publishMessageStatus(payload: unknown) {
  return pub.publish(CHANNELS.MESSAGE_STATUS, JSON.stringify(payload))
}
export async function publishPresence(payload: unknown) {
  return pub.publish(CHANNELS.PRESENCE, JSON.stringify(payload))
}

// Subscription wiring
export async function initSubscriptions(handlers: Partial<Record<Channel, (data: any) => void>>) {
  await connectRedis()
  const channelList = Object.values(CHANNELS)
  await sub.subscribe(...channelList)
  sub.on('message', (channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message)
      const h = handlers[channel as Channel]
      if (h) h(parsed)
    } catch (e) {
      console.error('❌ Failed to handle pub/sub message', channel, e)
    }
  })
  console.log('✅ Subscribed to Redis channels:', channelList.join(', '))
}

export async function shutdownRedis() {
  try { await pub.quit() } catch { }
  try { await sub.quit() } catch { }
}

