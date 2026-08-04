/**
 * preload/index.ts — contextBridge 暴露受控 API 给 renderer
 *
 * renderer 通过 window.memcore.* 调用，不能直接访问 Node/Electron API。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('memcore', {
  // 配置
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (patch: Record<string, string | null>) => ipcRenderer.invoke('config:save', patch),
  },

  // 图片
  image: {
    pick: (opts?: { multiple?: boolean }) => ipcRenderer.invoke('image:pick', opts),
    upload: (params: {
      filePath: string
      workspaceId?: string
      note?: string
      sessionId?: string
    }) => ipcRenderer.invoke('image:upload', params),
    getUrl: (objectKey: string) => ipcRenderer.invoke('image:getUrl', objectKey),
    toBase64: (url: string) => ipcRenderer.invoke('image:toBase64', url),
  },

  // 认证
  auth: {
    login: (params: { email: string; code: string }) => ipcRenderer.invoke('auth:login', params),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
  },

  // App
  app: {
    reloadDashboard: () => ipcRenderer.invoke('app:reloadDashboard'),
    openSettings: () => ipcRenderer.invoke('app:openSettings'),
  },

  // 从主进程接收事件（菜单触发的图片上传）
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['menu:uploadImage']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    // P1-3 修复：off 同样做白名单校验，防止移除非预期监听器
    const validChannels = ['menu:uploadImage']
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    }
  },
})
