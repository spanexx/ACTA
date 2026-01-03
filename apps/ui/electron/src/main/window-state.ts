/*
 * Code Map: Main Window State
 * - Stores a single reference to the main BrowserWindow for cross-module access.
 *
 * CID Index:
 * CID:window-state-001 -> mainWindow (module state)
 * CID:window-state-002 -> getMainWindow
 * CID:window-state-003 -> setMainWindow
 *
 * Lookup: rg -n "CID:window-state-" apps/ui/electron/src/main/window-state.ts
 */

import type { BrowserWindow } from 'electron'

// CID:window-state-001 - Main Window Reference
// Purpose: Stores the current main BrowserWindow instance (or null).
// Uses: BrowserWindow type
// Used by: create-window.ts (setter), ipc-handlers.ts (getter for emitting events)
let mainWindow: BrowserWindow | null = null

// CID:window-state-002 - Get Main Window
// Purpose: Returns the current main BrowserWindow (if any).
// Uses: mainWindow module state
// Used by: ipc-handlers.ts (profileChanged event emission)
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// CID:window-state-003 - Set Main Window
// Purpose: Updates the stored main BrowserWindow reference.
// Uses: mainWindow module state
// Used by: create-window.ts
export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}
