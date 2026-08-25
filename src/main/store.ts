/**
 * store.ts — 本地持久化存储
 *
 * 非敏感数据：electron-store（JSON 文件）
 * 敏感数据（API Key）：electron safeStorage 加密后存 store
 */

import Store from 'electron-store'
import { safeStorage } from 'electron'
import { randomUUID } from 'crypto'

// ── 类型定义 ──────────────────────────────────────────────────────────────────

export interface ModelConfig {
  id: string
  name: string
  baseUrl: string
  modelName: string
  /** Key 不存这里，存 safeStorage，key = "modelKey:{id}" */
}

export interface InstanceConfig {
  id: string
  name: string
  modelId: string
  workspaceId: string
  sessionId: string
  systemPrompt?: string
  tags?: string[]
  createdAt: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface UserInfo {
  email: string
  plan: string
}

export interface ArchiveItem {
  turnId: string
  instanceId: string
  workspaceId: string
  sessionId: string
  userContent: string
  assistantContent: string
  retryCount: number
  createdAt: number
}

interface StoreSchema {
  onboardingDone: boolean
  advancedMode: boolean
  encryptedApiKey?: string
  userInfo?: UserInfo
  models: ModelConfig[]
  instances: InstanceConfig[]
  conversations: Record<string, ChatMessage[]>
  /** 归档重试队列，按 instanceId 分组 */
  archiveQueue: Record<string, ArchiveItem[]>
  /** memcore-api 地址（可配置） */
  apiBaseUrl: string
  /** SuperModel 地址（可配置） */
  supermodelUrl: string
}

const store = new Store<StoreSchema>({
  defaults: {
    onboardingDone: false,
    advancedMode: false,
    models: [],
    instances: [],
    conversations: {},
    archiveQueue: {},
    apiBaseUrl: 'https://api-dev.memspider.com',
    supermodelUrl: 'http://172.236.254.239:31004',
  },
})

// ── safeStorage 工具 ───────────────────────────────────────────────────────────

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(value).toString('base64')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decryptValue(encoded: string): string | null {
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

// ── MS API Key ─────────────────────────────────────────────────────────────────

export function saveApiKey(key: string): void {
  store.set('encryptedApiKey', encryptValue(key))
}

export function getApiKey(): string | null {
  const encoded = store.get('encryptedApiKey')
  if (!encoded) return null
  return decryptValue(encoded)
}

export function clearApiKey(): void {
  store.delete('encryptedApiKey')
}

// ── 用户信息 ──────────────────────────────────────────────────────────────────

export function saveUserInfo(info: UserInfo): void {
  store.set('userInfo', info)
}

export function getUserInfo(): UserInfo | null {
  return store.get('userInfo') ?? null
}

// ── 算力模型 ──────────────────────────────────────────────────────────────────

/** Key 存 safeStorage，storeName = "modelKey:{id}" */
function modelKeyName(id: string): string {
  return `modelKey_${id}`
}

export function saveModelKey(id: string, key: string): void {
  store.set(modelKeyName(id) as any, encryptValue(key))
}

export function getModelKey(id: string): string | null {
  const encoded = (store as any).get(modelKeyName(id))
  if (!encoded) return null
  return decryptValue(encoded)
}

export function deleteModelKey(id: string): void {
  ;(store as any).delete(modelKeyName(id))
}

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
  deleteModelKey(id)
}

// ── 实例 ──────────────────────────────────────────────────────────────────────

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
  // 同时删除对话历史
  const conversations = store.get('conversations')
  delete conversations[id]
  store.set('conversations', conversations)
}

export function newInstance(data: {
  name: string
  modelId: string
  workspaceId: string
  systemPrompt?: string
  tags?: string[]
}): InstanceConfig {
  const instance: InstanceConfig = {
    id: randomUUID(),
    sessionId: randomUUID(),
    createdAt: Date.now(),
    ...data,
  }
  saveInstance(instance)
  return instance
}

// ── 对话历史 ──────────────────────────────────────────────────────────────────

const MAX_MESSAGES = 500

export function getConversation(instanceId: string): ChatMessage[] {
  return store.get('conversations')[instanceId] ?? []
}

export function appendMessage(instanceId: string, msg: ChatMessage): void {
  const conversations = store.get('conversations')
  const msgs = conversations[instanceId] ?? []
  msgs.push(msg)
  // 超出上限：截掉最旧的 100 条
  if (msgs.length > MAX_MESSAGES) {
    msgs.splice(0, 100)
  }
  conversations[instanceId] = msgs
  store.set('conversations', conversations)
}

export function updateLastAssistantMessage(instanceId: string, content: string): void {
  const conversations = store.get('conversations')
  const msgs = conversations[instanceId] ?? []
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') {
      msgs[i].content = content
      break
    }
  }
  conversations[instanceId] = msgs
  store.set('conversations', conversations)
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

// ── 版本迁移：清除旧的错误 API 地址 ───────────────────────────────────────
const LEGACY_URLS = [
  'http://172.236.254.239:31003',
  'http://172.236.254.239:31015',
  'http://172.236.254.239:31012',
]
const currentApiUrl = store.get('apiBaseUrl')
if (LEGACY_URLS.includes(currentApiUrl)) {
  store.set('apiBaseUrl', 'https://api-dev.memspider.com')
}
// 同时修复旧的 supermodelUrl
const LEGACY_SUPERMODEL_URLS = [
  'http://172.236.254.239:31000',
  'http://172.236.254.239:31015',
]
const currentSupermodelUrl = store.get('supermodelUrl')
if (LEGACY_SUPERMODEL_URLS.includes(currentSupermodelUrl)) {
  store.set('supermodelUrl', 'http://172.236.254.239:31004')
}

export function getApiBaseUrl(): string {
  return store.get('apiBaseUrl')
}

export function getSupermodelUrl(): string {
  return store.get('supermodelUrl')
}

// ── 归档重试队列 ──────────────────────────────────────────────────────────────

export function getArchiveQueue(): Record<string, ArchiveItem[]> {
  return store.get('archiveQueue')
}

export function enqueueArchive(item: ArchiveItem): void {
  const queue = getArchiveQueue()
  const list = queue[item.instanceId] ?? []
  // 幂等：同 turnId 已在队列则不重复添加
  if (!list.find((i) => i.turnId === item.turnId)) {
    list.push(item)
    queue[item.instanceId] = list
    store.set('archiveQueue', queue)
  }
}

export function removeFromQueue(instanceId: string, turnId: string): void {
  const queue = getArchiveQueue()
  const list = (queue[instanceId] ?? []).filter((i) => i.turnId !== turnId)
  queue[instanceId] = list
  store.set('archiveQueue', queue)
}

export function incrementRetry(instanceId: string, turnId: string): void {
  const queue = getArchiveQueue()
  const list = queue[instanceId] ?? []
  const item = list.find((i) => i.turnId === turnId)
  if (item) {
    item.retryCount += 1
    store.set('archiveQueue', queue)
  }
}

export { store }
