/**
 * Check if the given origin is allowed to connect to the IPC WebSocket server.
 *
 * @param origin - The origin string to check.
 * @returns True if the origin is allowed, false otherwise.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false

  if (origin.startsWith('file://')) return true

  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:') return false
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return false
    return true
  } catch {
    return false
  }
}
