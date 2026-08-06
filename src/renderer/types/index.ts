/**
 * renderer/types/index.ts — Renderer 层类型入口
 *
 * 重新导出 shared types，并添加 renderer 专属的全局声明（window.electronAPI）。
 */

export type {
  UserInfo,
  Model,
  AddModelRequest,
  Instance,
  CreateInstanceRequest,
  MessageRole,
  Message,
  LlmDeltaPayload,
  LlmDonePayload,
  LlmErrorPayload,
  IpcResult,
} from '../../shared/types'

import type {
  UserInfo,
  Model,
  AddModelRequest,
  Instance,
  CreateInstanceRequest,
  MessageRole,
  Message,
  LlmDeltaPayload,
  LlmDonePayload,
  LlmErrorPayload,
  IpcResult,
} from '../../shared/types'

// ── electronAPI 类型声明（window.electronAPI） ────────────────────────────────

export interface ElectronAPI {
  auth: {
    verify: (key: string) => Promise<IpcResult<UserInfo>>
    getKey: () => Promise<{ ok: boolean; key: string | null }>
    clear: () => Promise<IpcResult>
    getUserInfo: () => Promise<IpcResult<UserInfo>>
  }
  settings: {
    getAdvancedMode: () => Promise<{ ok: boolean; value: boolean }>
    setAdvancedMode: (enabled: boolean) => Promise<IpcResult>
    getOnboardingDone: () => Promise<{ ok: boolean; value: boolean }>
  }
  models: {
    list: () => Promise<IpcResult<Model[]>>
    add: (model: AddModelRequest) => Promise<IpcResult<{ id: string }>>
    delete: (id: string) => Promise<IpcResult>
  }
  instances: {
    list: () => Promise<IpcResult<Instance[]>>
    create: (data: CreateInstanceRequest) => Promise<IpcResult<Instance>>
    delete: (id: string) => Promise<IpcResult>
  }
  llm: {
    streamChat: (
      requestId: string,
      modelId: string,
      messages: { role: MessageRole; content: string }[]
    ) => Promise<IpcResult>
    abort: (requestId: string) => Promise<IpcResult>
    onDelta: (cb: (payload: LlmDeltaPayload) => void) => () => void
    onDone: (cb: (payload: LlmDonePayload) => void) => () => void
    onError: (cb: (payload: LlmErrorPayload) => void) => () => void
  }
  conversations: {
    get: (instanceId: string) => Promise<IpcResult<Message[]>>
    append: (instanceId: string, message: Message) => Promise<IpcResult>
    clear: (instanceId: string) => Promise<IpcResult>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
