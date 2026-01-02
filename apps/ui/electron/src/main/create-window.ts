import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { setMainWindow } from './window-state'

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
