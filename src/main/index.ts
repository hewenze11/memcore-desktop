/**
 * main/index.ts — Electron 主进程入口
 *
 * 窗口策略：
 *   mainWindow   — BrowserWindow，loadURL memory-spider-web（http://172.236.254.239:31013）
 *   settingsWin  — BrowserWindow，loadFile renderer/settings.html（算力层配置）
 *
 * 安全配置：
 *   - nodeIntegration: false（禁止 renderer 直接访问 Node）
 *   - contextIsolation: true（强制隔离）
 *   - preload 通过 contextBridge 暴露受控 API
 */

import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import * as path from 'path'
import { loadConfig } from './keychain'

// 注册所有 IPC handler
import './ipc'

// ── 常量 ─────────────────────────────────────────────────────────────────────

// memory-spider-web 测试环境地址（可通过 keychain config 覆盖）
const DEFAULT_DASHBOARD_URL = 'http://172.236.254.239:31013'

// ── 窗口引用 ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

// ── 主窗口 ────────────────────────────────────────────────────────────────────

async function createMainWindow(): Promise<void> {
  const config = await loadConfig()
  const dashboardUrl = config.apiBaseUrl
    ? config.apiBaseUrl.replace(':31010', ':31013')
    : DEFAULT_DASHBOARD_URL

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MemCore',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      // P0-2 修复：webSecurity 必须保持 true（默认值），禁止关闭同源策略
      // 关闭会导致 XSS → fetch('file://') 读本地文件，与暴露的 IPC 能力组合成 RCE 链
      webSecurity: true,
      sandbox: true,
    },
  })

  mainWindow.loadURL(dashboardUrl).catch(() => {
    // Dashboard 加载失败时，显示离线提示页
    mainWindow!.loadFile(path.join(__dirname, '../../src/renderer/offline.html'))
  })

  // P0-2 修复：所有新窗口请求一律拒绝，白名单内的用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      const allowedHosts = ['localhost', '172.236.254.239', '172.236.254.94', 'cayan.ai', 'www.cayan.ai']
      if (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        (allowedHosts.includes(parsed.hostname) || parsed.hostname.endsWith('.cayan.ai'))
      ) {
        shell.openExternal(url)
      }
      // 白名单外的 URL 静默丢弃，不打开
    } catch {
      // URL parse 失败，静默丢弃
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── 设置窗口 ──────────────────────────────────────────────────────────────────

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    title: 'MemCore 设置',
    parent: mainWindow || undefined,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  })

  settingsWindow.loadFile(path.join(__dirname, '../../src/renderer/settings.html'))

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ── 菜单 ──────────────────────────────────────────────────────────────────────

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => createSettingsWindow(),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '图片',
      submenu: [
        {
          label: '上传图片到记忆空间',
          accelerator: 'CmdOrCtrl+U',
          click: () => {
            mainWindow?.webContents.send('menu:uploadImage')
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 MemCore',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox({
              type: 'info',
              title: '关于 MemCore',
              message: 'MemCore Desktop',
              detail: `版本：${app.getVersion()}\nElectron：${process.versions.electron}\nNode：${process.versions.node}`,
              buttons: ['确定'],
            })
          },
        },
        {
          label: '打开官网',
          click: () => shell.openExternal('https://cayan.ai'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ── IPC：从设置窗口重新加载主窗口 ─────────────────────────────────────────────

ipcMain.handle('app:reloadDashboard', async () => {
  const config = await loadConfig()
  const dashboardUrl = config.apiBaseUrl
    ? config.apiBaseUrl.replace(':31010', ':31013')
    : DEFAULT_DASHBOARD_URL
  mainWindow?.loadURL(dashboardUrl)
  return { ok: true }
})

ipcMain.handle('app:openSettings', () => {
  createSettingsWindow()
  return { ok: true }
})

// ── App 生命周期 ───────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  buildMenu()
  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// P0-2 修复：全局安全加固，限制所有 webContents 的导航
app.on('web-contents-created', (_event: Electron.Event, contents: Electron.WebContents) => {
  const allowedHosts = ['localhost', '172.236.254.239', '172.236.254.94', 'cayan.ai', 'www.cayan.ai']

  // 拦截同窗口导航
  contents.on('will-navigate', (event: Electron.Event, navigationUrl: string) => {
    try {
      const parsedUrl = new URL(navigationUrl)
      if (!allowedHosts.includes(parsedUrl.hostname) && !parsedUrl.hostname.endsWith('.cayan.ai')) {
        event.preventDefault()
        shell.openExternal(navigationUrl)
      }
    } catch {
      event.preventDefault()
    }
  })

  // 拦截重定向（防止白名单内的页面重定向到外部）
  contents.on('will-redirect', (event: Electron.Event, redirectUrl: string) => {
    try {
      const parsedUrl = new URL(redirectUrl)
      if (!allowedHosts.includes(parsedUrl.hostname) && !parsedUrl.hostname.endsWith('.cayan.ai')) {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()
    }
  })
})
