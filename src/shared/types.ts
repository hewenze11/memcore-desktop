/**
 * shared/types.ts — 跨层共享 TypeScript 类型
 *
 * 此文件被 main、preload、renderer 三层共同引用。
 * 不依赖任何平台特定 API（纯类型定义）。
 */

// ── 用户信息 ──────────────────────────────────────────────────────────────────

export interface UserInfo {
  id: string
  email: string
  plan: string
  quotaUsedBytes: number
  quotaLimitBytes: number
}

// ── 算力模型 ──────────────────────────────────────────────────────────────────

/** 存储在 store 中的模型配置（不含 Key） */
export interface Model {
  id: string
  name: string
  baseUrl: string
  modelName: string
}

/** 添加模型时传入的完整参数（含 Key，仅在 IPC 调用时传入主进程） */
export interface AddModelRequest {
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
}

// ── AI 实例 ───────────────────────────────────────────────────────────────────

export interface Instance {
  id: string
  name: string
  modelId: string
  workspaceId: string
  systemPrompt?: string
  tags?: string[]
  createdAt: string
}

/** 创建实例时传入的参数 */
export interface CreateInstanceRequest {
  name: string
  modelId: string
  systemPrompt?: string
  tags?: string[]
}

// ── 消息 ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  ts: number
}

// ── 流式回传数据 ──────────────────────────────────────────────────────────────

export interface LlmDeltaPayload {
  requestId: string
  delta: string
}

export interface LlmDonePayload {
  requestId: string
}

export interface LlmErrorPayload {
  requestId: string
  error: string
}

// ── IPC 统一返回格式 ──────────────────────────────────────────────────────────

export interface IpcResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}
