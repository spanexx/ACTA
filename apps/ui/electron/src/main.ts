import { app, BrowserWindow } from 'electron'
import { createWindow } from './main/create-window'
import { registerIpcHandlers } from './main/ipc-handlers'
import {
  ensureProfileExists,
  getActiveProfileId,
  loadActiveProfileId,
  persistActiveProfileId,
} from './main/profiles.service'

registerIpcHandlers()

app.on('ready', () => {
  void (async () => {
    await loadActiveProfileId()
    const profileId = getActiveProfileId()
    await ensureProfileExists(profileId, profileId === 'default' ? 'Default' : profileId)
    await persistActiveProfileId(profileId)
    await createWindow()
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
