/**
 * preload/index.ts — contextBridge 白名单 API
 *
 * renderer 只能通过 window.electronAPI.* 访问，不能直接用 ipcRenderer。
 * Key 不出 renderer：所有含 Key 的操作都在主进程执行。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    verify: (key: string) => ipcRenderer.invoke('auth.verify', key),
    getKey: () => ipcRenderer.invoke('auth.getKey'),
    clear: () => ipcRenderer.invoke('auth.clear'),
    getUserInfo: () => ipcRenderer.invoke('auth.getUserInfo'),
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    getAdvancedMode: () => ipcRenderer.invoke('settings.getAdvancedMode'),
    setAdvancedMode: (enabled: boolean) => ipcRenderer.invoke('settings.setAdvancedMode', enabled),
    getOnboardingDone: () => ipcRenderer.invoke('settings.getOnboardingDone'),
  },

  // ── Models ─────────────────────────────────────────────────────────────────
  models: {
    list: () => ipcRenderer.invoke('models.list'),
    add: (data: { name: string; baseUrl: string; apiKey: string; modelName: string }) =>
      ipcRenderer.invoke('models.add', data),
    delete: (id: string) => ipcRenderer.invoke('models.delete', id),
  },

  // ── Instances ──────────────────────────────────────────────────────────────
  instances: {
    list: () => ipcRenderer.invoke('instances.list'),
    create: (data: { name: string; modelId: string; systemPrompt?: string; tags?: string[] }) =>
      ipcRenderer.invoke('instances.create', data),
    delete: (id: string) => ipcRenderer.invoke('instances.delete', id),
  },

  // ── Conversations ──────────────────────────────────────────────────────────
  conversations: {
    get: (instanceId: string) => ipcRenderer.invoke('conversations.get', instanceId),
  },

  // ── LLM 流式推理 ────────────────────────────────────────────────────────────
  llm: {
    streamChat: (data: {
      requestId: string
      instanceId: string
      modelId: string
      messages: Array<{ role: string; content: string }>
      systemPrompt?: string
      skipRecall?: boolean
      overrideContext?: string
    }) => ipcRenderer.invoke('llm.streamChat', data),

    abort: (requestId: string) => ipcRenderer.invoke('llm.abort', requestId),

    /**
     * 订阅流事件（标准模式：具名函数注销，requestId 过滤）
     * 返回 cleanup 函数，调用方负责在 done/error 后调用
     */
    subscribe: (
      requestId: string,
      onDelta: (delta: string) => void,
      onDone: () => void,
      onError: (error: string) => void
    ) => {
      const listeners = {
        delta: (_: unknown, data: { requestId: string; delta: string }) => {
          if (data.requestId !== requestId) return
          onDelta(data.delta)
        },
        done: (_: unknown, data: { requestId: string }) => {
          if (data.requestId !== requestId) return
          cleanup()
          onDone()
        },
        error: (_: unknown, data: { requestId: string; error: string }) => {
          if (data.requestId !== requestId) return
          cleanup()
          onError(data.error)
        },
      }

      function cleanup() {
        ipcRenderer.removeListener('llm:delta', listeners.delta)
        ipcRenderer.removeListener('llm:done', listeners.done)
        ipcRenderer.removeListener('llm:error', listeners.error)
      }

      ipcRenderer.on('llm:delta', listeners.delta)
      ipcRenderer.on('llm:done', listeners.done)
      ipcRenderer.on('llm:error', listeners.error)

      return cleanup
    },
  },

  // ── Memory 状态事件 ────────────────────────────────────────────────────────
  memory: {
    /**
     * 订阅记忆状态变化事件
     * status: 'recalling' | 'degraded' | 'archived' | 'queued'
     * 返回 cleanup 函数
     */
    onStatus: (callback: (data: { status: string; reason?: string; instanceId?: string; context?: string; advancedMode?: boolean }) => void) => {
      const listener = (_: unknown, data: { status: string; reason?: string; instanceId?: string; context?: string; advancedMode?: boolean }) => callback(data)
      ipcRenderer.on('memory:status', listener)
      return () => ipcRenderer.removeListener('memory:status', listener)
    },
    recallOnly: (data: {
      instanceId: string
      userMessage: string
      supplementInstr?: string
      recallVersion?: number
    }) => ipcRenderer.invoke('memory.recallOnly', data),
  },

  // ── Dialog ─────────────────────────────────────────────────────────────────
  dialog: {
    confirm: (message: string) => ipcRenderer.invoke('dialog.confirm', message),
  },

  // ── M4：记忆空间代理请求 ────────────────────────────────────────────────────
  memspace: {
    request: (data: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      path: string
      body?: unknown
    }) => ipcRenderer.invoke('memspace.request', data),
  },

  // ── Window ─────────────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
})
