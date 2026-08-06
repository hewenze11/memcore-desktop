/**
 * preload/index.ts — contextBridge 暴露白名单 API 给 renderer
 *
 * renderer 通过 window.electronAPI.* 调用，不能直接访问 Node/Electron API。
 * 所有 ipcRenderer.on 订阅都在此封装，并返回 cleanup 函数供 renderer 卸载。
 */

import { contextBridge, ipcRenderer } from 'electron'
import type {
  AddModelRequest,
  CreateInstanceRequest,
  MessageRole,
  LlmDeltaPayload,
  LlmDonePayload,
  LlmErrorPayload,
} from '../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    verify: (key: string) => ipcRenderer.invoke('auth.verify', key),
    getKey: () => ipcRenderer.invoke('auth.getKey'),
    clear: () => ipcRenderer.invoke('auth.clear'),
    getUserInfo: () => ipcRenderer.invoke('auth.getUserInfo'),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    getAdvancedMode: () => ipcRenderer.invoke('settings.getAdvancedMode'),
    setAdvancedMode: (enabled: boolean) => ipcRenderer.invoke('settings.setAdvancedMode', enabled),
    getOnboardingDone: () => ipcRenderer.invoke('settings.getOnboardingDone'),
  },

  // ── Models ────────────────────────────────────────────────────────────────
  models: {
    list: () => ipcRenderer.invoke('models.list'),
    add: (model: AddModelRequest) => ipcRenderer.invoke('models.add', model),
    delete: (id: string) => ipcRenderer.invoke('models.delete', id),
  },

  // ── Instances ─────────────────────────────────────────────────────────────
  instances: {
    list: () => ipcRenderer.invoke('instances.list'),
    create: (data: CreateInstanceRequest) => ipcRenderer.invoke('instances.create', data),
    delete: (id: string) => ipcRenderer.invoke('instances.delete', id),
  },

  // ── LLM 流式对话 ──────────────────────────────────────────────────────────
  llm: {
    streamChat: (
      requestId: string,
      modelId: string,
      messages: { role: MessageRole; content: string }[]
    ) => ipcRenderer.invoke('llm.streamChat', requestId, modelId, messages),

    abort: (requestId: string) => ipcRenderer.invoke('llm.abort', requestId),

    /**
     * 订阅 llm:delta 事件，返回 cleanup 函数
     * renderer 在组件卸载时调用 cleanup，避免内存泄漏
     */
    onDelta: (cb: (payload: LlmDeltaPayload) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: LlmDeltaPayload) => cb(payload)
      ipcRenderer.on('llm:delta', listener)
      return () => ipcRenderer.removeListener('llm:delta', listener)
    },

    onDone: (cb: (payload: LlmDonePayload) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: LlmDonePayload) => cb(payload)
      ipcRenderer.on('llm:done', listener)
      return () => ipcRenderer.removeListener('llm:done', listener)
    },

    onError: (cb: (payload: LlmErrorPayload) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: LlmErrorPayload) => cb(payload)
      ipcRenderer.on('llm:error', listener)
      return () => ipcRenderer.removeListener('llm:error', listener)
    },
  },

  // ── Conversations ─────────────────────────────────────────────────────────
  conversations: {
    get: (instanceId: string) => ipcRenderer.invoke('conversations.get', instanceId),
    append: (instanceId: string, message: {
      id: string
      role: string
      content: string
      ts: number
    }) => ipcRenderer.invoke('conversations.append', instanceId, message),
    clear: (instanceId: string) => ipcRenderer.invoke('conversations.clear', instanceId),
  },

  // ── Window ────────────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
})
