/**
 * store.ts — electron-store 封装（非敏感数据本地持久化）
 *
 * 敏感数据（API Key、模型 Key）使用 electron safeStorage 加密，不以明文存在 store 中。
 * 模型 Key 的 safeStorage key 格式：`modelKey:{modelId}`
 */

import Store from 'electron-store'
import { safeStorage } from 'electron'

// ── Store Schema ──────────────────────────────────────────────────────────────

interface ModelConfig {
  id: string
  name: string
  baseUrl: string
  modelName: string
}

interface InstanceConfig {
  id: string
  name: string
  modelId: string
  workspaceId: string
  systemPrompt?: string
  tags?: string[]
  createdAt: string
}

interface MessageRecord {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: number
}

interface UserInfoRecord {
  id: string
  email: string
  plan: string
  quotaUsedBytes: number
  quotaLimitBytes: number
}

interface StoreSchema {
  /** 是否已完成引导流程 */
  onboardingDone: boolean
  /** 加密存储的 MS API Key（Base64 of encrypted Buffer） */
  encryptedApiKey?: string
  /** 高级模式开关 */
  advancedMode: boolean
  /** memcore-api 地址（可配置） */
  apiBaseUrl: string
  /** 算力模型配置列表（不含 Key） */
  models: ModelConfig[]
  /** AI 实例列表 */
  instances: InstanceConfig[]
  /** 对话历史：{ [instanceId]: MessageRecord[] } */
  conversations: Record<string, MessageRecord[]>
  /** 当前登录用户信息 */
  userInfo?: UserInfoRecord
}

const store = new Store<StoreSchema>({
  defaults: {
    onboardingDone: false,
    advancedMode: false,
    apiBaseUrl: 'http://172.236.254.239:31003',
    models: [],
    instances: [],
    conversations: {},
  },
})

// ── API Base URL ──────────────────────────────────────────────────────────────

export function getApiBaseUrl(): string {
  return store.get('apiBaseUrl')
}

export function setApiBaseUrl(url: string): void {
  store.set('apiBaseUrl', url)
}

// ── MS API Key（safeStorage 加密） ────────────────────────────────────────────

/**
 * 保存 MS API Key（用 OS keychain 加密）
 */
export function saveApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // safeStorage 不可用时，调用方应已提前报错，这里不做降级
    throw new Error('safeStorage 不可用，无法安全存储 API Key')
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
      return null
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

// ── 用户信息 ──────────────────────────────────────────────────────────────────

export function saveUserInfo(info: UserInfoRecord): void {
  store.set('userInfo', info)
}

export function getUserInfo(): UserInfoRecord | undefined {
  return store.get('userInfo')
}

export function clearUserInfo(): void {
  store.delete('userInfo')
}

// ── 算力模型（配置不含 Key） ──────────────────────────────────────────────────

export function getModels(): ModelConfig[] {
  return store.get('models')
}

export function saveModel(model: ModelConfig): void {
  const models = getModels()
  const idx = models.findIndex((m) => m.id === model.id)
  if (idx >= 0) {
    models[idx] = model
  } else {
    models.push(model)
  }
  store.set('models', models)
}

export function deleteModel(id: string): void {
  const models = getModels().filter((m) => m.id !== id)
  store.set('models', models)
}

// ── 模型 Key（safeStorage，key = "modelKey:{modelId}"） ───────────────────────

/**
 * 保存算力模型 API Key
 */
export function saveModelKey(modelId: string, apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage 不可用，无法安全存储模型 Key')
  }
  const encrypted = safeStorage.encryptString(apiKey)
  store.set(`modelKey_${modelId}` as keyof StoreSchema, encrypted.toString('base64') as never)
}

/**
 * 读取算力模型 API Key
 */
export function getModelKey(modelId: string): string | null {
  const encoded = (store as Store<Record<string, string>>).get(`modelKey_${modelId}`)
  if (!encoded) return null
  try {
    const buf = Buffer.from(encoded, 'base64')
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

/**
 * 删除算力模型 API Key
 */
export function deleteModelKey(modelId: string): void {
  (store as Store<Record<string, unknown>>).delete(`modelKey_${modelId}`)
}

// ── AI 实例 ───────────────────────────────────────────────────────────────────

export function getInstances(): InstanceConfig[] {
  return store.get('instances')
}

export function saveInstance(instance: InstanceConfig): void {
  const instances = getInstances()
  const idx = instances.findIndex((i) => i.id === instance.id)
  if (idx >= 0) {
    instances[idx] = instance
  } else {
    instances.push(instance)
  }
  store.set('instances', instances)
}

export function deleteInstance(id: string): void {
  const instances = getInstances().filter((i) => i.id !== id)
  store.set('instances', instances)
}

// ── 对话历史 ──────────────────────────────────────────────────────────────────

export function getConversation(instanceId: string): MessageRecord[] {
  const convs = store.get('conversations')
  return convs[instanceId] ?? []
}

export function appendMessage(instanceId: string, message: MessageRecord): void {
  const convs = store.get('conversations')
  const existing = convs[instanceId] ?? []
  convs[instanceId] = [...existing, message]
  store.set('conversations', convs)
}

export function clearConversation(instanceId: string): void {
  const convs = store.get('conversations')
  delete convs[instanceId]
  store.set('conversations', convs)
}

export { store }
