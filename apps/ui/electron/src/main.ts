/*
 * Code Map: Electron Main Entrypoint
 * - Registers IPC handlers.
 * - On app ready: loads/persists active profile and creates the main window.
 * - Handles macOS activate behavior and window-all-closed quit behavior.
 *
 * CID Index:
 * CID:main-001 -> registerIpcHandlers (startup wiring)
 * CID:main-002 -> app.on('ready') bootstrap
 * CID:main-003 -> app.on('window-all-closed')
 * CID:main-004 -> app.on('activate')
 *
 * Lookup: rg -n "CID:main-" apps/ui/electron/src/main.ts
 */

import { app, BrowserWindow } from 'electron'
import { createWindow } from './main/create-window'
import { registerIpcHandlers } from './main/ipc-handlers'
import {
  ensureProfileExists,
  getActiveProfileId,
  loadActiveProfileId,
  persistActiveProfileId,
} from './main/profiles.service'

// CID:main-001 - IPC Handler Registration
// Purpose: Registers IPC handlers so the renderer/preload can call into the main process.
// Uses: registerIpcHandlers()
// Used by: Electron main bootstrap
registerIpcHandlers()

// CID:main-002 - App Ready Bootstrap
// Purpose: Initializes active profile state and creates the main window once Electron is ready.
// Uses: profiles.service (load/get/ensure/persist), createWindow()
// Used by: Electron lifecycle
app.on('ready', () => {
  void (async () => {
    await loadActiveProfileId()
    const profileId = getActiveProfileId()
    await ensureProfileExists(profileId, profileId === 'default' ? 'Default' : profileId)
    await persistActiveProfileId(profileId)
    await createWindow()
  })()
})

// CID:main-003 - Quit On All Windows Closed
// Purpose: Quits the app on non-macOS platforms when all windows are closed.
// Uses: app.quit(), process.platform
// Used by: Electron lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// CID:main-004 - macOS Activate
// Purpose: Re-creates the main window when activating the app and no windows exist.
// Uses: BrowserWindow.getAllWindows(), createWindow()
// Used by: Electron lifecycle
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
