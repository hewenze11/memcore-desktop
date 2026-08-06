/**
 * main/index.ts — Electron 主进程入口
 *
 * 窗口策略：
 *   mainWindow — BrowserWindow，dev 模式加载 Vite dev server，生产加载 dist/renderer/index.html
 *
 * 安全配置：
 *   - nodeIntegration: false（禁止 renderer 直接访问 Node）
 *   - contextIsolation: true（强制隔离）
 *   - preload 通过 contextBridge 暴露受控 API
 */

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'

// 注册所有 IPC handler
import './ipc'

// ── 常量 ─────────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged

// ── 窗口引用 ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

// ── 主窗口 ────────────────────────────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MemCore',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      webSecurity: true,
      sandbox: false, // electron-store 需要在 preload 中访问 Node
    },
  })

  if (isDev) {
    // dev 模式：加载 Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载打包后的 renderer
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 所有新窗口请求一律用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC：窗口控制 ─────────────────────────────────────────────────────────────

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

// ── App 生命周期 ───────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
