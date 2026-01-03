/*
 * Code Map: Electron Window Creation
 * - createWindow(): Creates the main BrowserWindow, registers it in window-state, and loads Angular.
 *
 * CID Index:
 * CID:create-window-001 -> createWindow
 *
 * Lookup: rg -n "CID:create-window-" apps/ui/electron/src/main/create-window.ts
 */

import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { setMainWindow } from './window-state'

// CID:create-window-001 - Create Main Window
// Purpose: Creates the Electron main window and loads the Angular app (file:// in prod, http:// in dev).
// Uses: BrowserWindow, app.isPackaged, window-state.setMainWindow
// Used by: electron/src/main.ts on app ready/activate
export async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(path.resolve(__dirname, '..'), 'preload.js'),
    },
  })

  setMainWindow(mainWindow)

  if (app.isPackaged) {
    const electronDistDir = path.resolve(__dirname, '..')
    await mainWindow.loadFile(path.join(electronDistDir, '../../dist/angular/browser/index.html'))
  } else {
    await mainWindow.loadURL('http://localhost:4200')
  }
}
