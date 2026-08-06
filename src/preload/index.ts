/**
 * preload/index.ts — contextBridge 暴露白名单 API 给 renderer
 *
 * renderer 通过 window.electronAPI.* 调用，不能直接访问 Node/Electron API。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    verify: (key: string) => ipcRenderer.invoke('auth.verify', key),
    getKey: () => ipcRenderer.invoke('auth.getKey'),
    clear: () => ipcRenderer.invoke('auth.clear'),
  },
  settings: {
    getAdvancedMode: () => ipcRenderer.invoke('settings.getAdvancedMode'),
    setAdvancedMode: (enabled: boolean) => ipcRenderer.invoke('settings.setAdvancedMode', enabled),
    getOnboardingDone: () => ipcRenderer.invoke('settings.getOnboardingDone'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
})
