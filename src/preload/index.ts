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

  // ── Window ─────────────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
})
