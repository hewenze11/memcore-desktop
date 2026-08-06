/** 共享类型定义（renderer 侧） */

export interface ModelConfig {
  id: string
  name: string
  baseUrl: string
  modelName: string
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
  msgId?: string  // 稳定唯一 ID，用于 React key，防止 state 泄漏
}

export interface UserInfo {
  email: string
  plan: string
}
