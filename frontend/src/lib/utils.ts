import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the appropriate API URL based on whether running on server or client
 */
export function getApiUrl(): string {
  // Check if we're on the server side (Node.js environment)
  if (typeof window === 'undefined') {
    // Server-side: use internal Docker network URL
    return process.env.INTERNAL_API_URL || "http://backend1:4000"
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
}

/**
 * Get the appropriate Socket URL based on whether running on server or client
 */
export function getSocketUrl(): string {
  // Check if we're on the server side (Node.js environment)
  if (typeof window === 'undefined') {
    // Server-side: use internal Docker network URL
    return process.env.INTERNAL_SOCKET_URL || "http://backend1:4000"
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000"
}

/**
 * Get the appropriate Auth URL based on whether running on server or client
 */
export function getAuthUrl(): string {
  // Check if we're on the server side (Node.js environment)
  if (typeof window === 'undefined') {
    // Server-side: use internal Docker network URL
    return process.env.INTERNAL_AUTH_URL || "http://auth:5000"
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000"
}
