/**
 * ipc.ts — IPC handler 注册（白名单模式）
 *
 * 所有 IPC channel 在此统一注册。
 * renderer 通过 window.electronAPI.* 调用（preload 转发）。
 */

import { ipcMain } from 'electron'
import {
  saveApiKey,
  getApiKey,
  clearApiKey,
  getOnboardingDone,
  setOnboardingDone,
  getAdvancedMode,
  setAdvancedMode,
} from './store'

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * auth.verify — 验证 MS API Key
 * 目前做基础格式校验，后续可接 gateway 验证
 */
ipcMain.handle('auth.verify', async (_event, key: string) => {
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    return { ok: false, error: 'API Key 格式不正确，请检查后重试' }
  }

  // 保存到 safeStorage
  saveApiKey(key.trim())
  setOnboardingDone(true)

  return { ok: true }
})

/**
 * auth.getKey — 读取已保存的 API Key（masked）
 */
ipcMain.handle('auth.getKey', async () => {
  const key = getApiKey()
  if (!key) return { ok: false, key: null }
  // 只返回 masked 版本给 renderer
  const masked = key.slice(0, 4) + '****' + key.slice(-4)
  return { ok: true, key: masked }
})

/**
 * auth.clear — 清除 API Key（退出登录）
 */
ipcMain.handle('auth.clear', async () => {
  clearApiKey()
  setOnboardingDone(false)
  return { ok: true }
})

// ── Settings ──────────────────────────────────────────────────────────────────

ipcMain.handle('settings.getAdvancedMode', async () => {
  return { ok: true, value: getAdvancedMode() }
})

ipcMain.handle('settings.setAdvancedMode', async (_event, enabled: boolean) => {
  setAdvancedMode(enabled)
  return { ok: true }
})

ipcMain.handle('settings.getOnboardingDone', async () => {
  return { ok: true, value: getOnboardingDone() }
})

export {}
