/**
 * keychain.ts — OS Keychain 封装（Windows DPAPI / macOS Keychain / libsecret）
 *
 * 用 keytar 读写敏感数据，绝不明文落盘。
 * service 固定为 "memcore-desktop"，account 即 key 名称。
 */

import keytar from 'keytar'

const SERVICE = 'memcore-desktop'

export async function keychainGet(account: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE, account)
  } catch {
    return null
  }
}

export async function keychainSet(account: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE, account, value)
}

export async function keychainDelete(account: string): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE, account)
  } catch {
    // 不存在时忽略
  }
}

/**
 * 读取全部用户配置（算力层 + API 地址）
 */
export interface AppConfig {
  /** memcore-api 地址，默认测试环境 */
  apiBaseUrl: string
  /** JWT token（登录后写入） */
  jwtToken: string | null
  /** 算力层 API Key */
  llmApiKey: string | null
  /** 算力层 Base URL */
  llmBaseUrl: string | null
  /** 算力层模型名称 */
  llmModel: string | null
  /** 算力层视觉模型名称 */
  llmVisionModel: string | null
}

export async function loadConfig(): Promise<AppConfig> {
  const [jwtToken, llmApiKey, llmBaseUrl, llmModel, llmVisionModel, apiBaseUrl] = await Promise.all([
    keychainGet('jwt_token'),
    keychainGet('llm_api_key'),
    keychainGet('llm_base_url'),
    keychainGet('llm_model'),
    keychainGet('llm_vision_model'),
    keychainGet('api_base_url'),
  ])
  return {
    apiBaseUrl: apiBaseUrl || 'http://172.236.254.239:31010',
    jwtToken,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    llmVisionModel,
  }
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  const tasks: Promise<void>[] = []
  if (patch.apiBaseUrl !== undefined) tasks.push(keychainSet('api_base_url', patch.apiBaseUrl))
  if (patch.jwtToken !== undefined) {
    tasks.push(patch.jwtToken ? keychainSet('jwt_token', patch.jwtToken) : keychainDelete('jwt_token'))
  }
  if (patch.llmApiKey !== undefined) {
    tasks.push(patch.llmApiKey ? keychainSet('llm_api_key', patch.llmApiKey) : keychainDelete('llm_api_key'))
  }
  if (patch.llmBaseUrl !== undefined) {
    tasks.push(patch.llmBaseUrl ? keychainSet('llm_base_url', patch.llmBaseUrl) : keychainDelete('llm_base_url'))
  }
  if (patch.llmModel !== undefined) {
    tasks.push(patch.llmModel ? keychainSet('llm_model', patch.llmModel) : keychainDelete('llm_model'))
  }
  if (patch.llmVisionModel !== undefined) {
    tasks.push(patch.llmVisionModel ? keychainSet('llm_vision_model', patch.llmVisionModel) : keychainDelete('llm_vision_model'))
  }
  await Promise.all(tasks)
}
