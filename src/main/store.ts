/**
 * store.ts — electron-store 封装（非敏感数据本地持久化）
 *
 * 敏感数据（API Key）使用 electron safeStorage，不走这里。
 */

import Store from 'electron-store'
import { safeStorage } from 'electron'

interface StoreSchema {
  /** 是否已完成引导流程 */
  onboardingDone: boolean
  /** 加密存储的 MS API Key（Base64 of encrypted Buffer） */
  encryptedApiKey?: string
  /** 高级模式开关 */
  advancedMode: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    onboardingDone: false,
    advancedMode: false,
  },
})

// ── API Key（safeStorage 加密）─────────────────────────────────────────────────

/**
 * 保存 MS API Key（用 OS keychain 加密）
 */
export function saveApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // 降级：明文存储（仅开发环境可能出现）
    store.set('encryptedApiKey', Buffer.from(key).toString('base64'))
    return
  }
  const encrypted = safeStorage.encryptString(key)
  store.set('encryptedApiKey', encrypted.toString('base64'))
}

/**
 * 读取 MS API Key
 */
export function getApiKey(): string | null {
  const encoded = store.get('encryptedApiKey')
  if (!encoded) return null

  try {
    const buf = Buffer.from(encoded, 'base64')
    if (!safeStorage.isEncryptionAvailable()) {
      return buf.toString('utf8')
    }
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

/**
 * 清除 API Key
 */
export function clearApiKey(): void {
  store.delete('encryptedApiKey')
}

// ── 通用设置 ──────────────────────────────────────────────────────────────────

export function getOnboardingDone(): boolean {
  return store.get('onboardingDone')
}

export function setOnboardingDone(done: boolean): void {
  store.set('onboardingDone', done)
}

export function getAdvancedMode(): boolean {
  return store.get('advancedMode')
}

export function setAdvancedMode(enabled: boolean): void {
  store.set('advancedMode', enabled)
}

export { store }
