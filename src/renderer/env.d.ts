/// <reference types="vite/client" />

interface ElectronAPI {
  auth: {
    verify: (key: string) => Promise<{ ok: boolean; error?: string }>
    getKey: () => Promise<{ ok: boolean; key: string | null }>
    clear: () => Promise<{ ok: boolean }>
  }
  settings: {
    getAdvancedMode: () => Promise<{ ok: boolean; value: boolean }>
    setAdvancedMode: (enabled: boolean) => Promise<{ ok: boolean }>
    getOnboardingDone: () => Promise<{ ok: boolean; value: boolean }>
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

export {}
