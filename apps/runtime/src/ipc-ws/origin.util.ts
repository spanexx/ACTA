/*
 * Code Map: IPC Origin Utility
 * - isAllowedOrigin: Validates incoming WebSocket origins
 *
 * CID Index:
 * CID:origin-util-001 -> isAllowedOrigin
 *
 * Quick lookup: rg -n "CID:origin-util-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/origin.util.ts
 */

/**
 * Check if the given origin is allowed to connect to the IPC WebSocket server.
 *
 * @param origin - The origin string to check.
 * @returns True if the origin is allowed, false otherwise.
 */
// CID:origin-util-001 - isAllowedOrigin
// Purpose: Ensure only local trusted origins can connect to IPC server
// Uses: URL parsing for http/localhost validation
// Used by: WS transport upgrade handler for connection filtering
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
