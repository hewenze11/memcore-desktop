/// <reference types="vite/client" />

import type { ModelConfig, InstanceConfig, ChatMessage, UserInfo } from './types'

declare global {
  interface Window {
    electronAPI: {
      auth: {
        verify: (key: string) => Promise<{ ok: boolean; error?: string; email?: string; plan?: string }>
        getKey: () => Promise<{ ok: boolean; key: string | null }>
        clear: () => Promise<{ ok: boolean }>
        getUserInfo: () => Promise<{ ok: boolean; userInfo: UserInfo | null }>
      }
      settings: {
        getAdvancedMode: () => Promise<{ ok: boolean; value: boolean }>
        setAdvancedMode: (enabled: boolean) => Promise<{ ok: boolean }>
        getOnboardingDone: () => Promise<{ ok: boolean; value: boolean }>
      }
      models: {
        list: () => Promise<{ ok: boolean; models: ModelConfig[] }>
        add: (data: { name: string; baseUrl: string; apiKey: string; modelName: string }) =>
          Promise<{ ok: boolean; error?: string; model?: ModelConfig }>
        delete: (id: string) => Promise<{ ok: boolean }>
      }
      instances: {
        list: () => Promise<{ ok: boolean; instances: InstanceConfig[] }>
        create: (data: { name: string; modelId: string; systemPrompt?: string; tags?: string[] }) =>
          Promise<{ ok: boolean; error?: string; instance?: InstanceConfig }>
        delete: (id: string) => Promise<{ ok: boolean }>
      }
      conversations: {
        get: (instanceId: string) => Promise<{ ok: boolean; messages: ChatMessage[] }>
      }
      llm: {
        streamChat: (data: {
          requestId: string
          instanceId: string
          modelId: string
          messages: Array<{ role: string; content: string }>
          systemPrompt?: string
        }) => Promise<{ ok: boolean; error?: string }>
        abort: (requestId: string) => Promise<{ ok: boolean }>
        subscribe: (
          requestId: string,
          onDelta: (delta: string) => void,
          onDone: () => void,
          onError: (error: string) => void
        ) => () => void
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
      }
    }
  }
}
