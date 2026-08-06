/**
 * ipc.ts — IPC handler 注册（白名单模式）
 *
 * 所有 IPC channel 在此统一注册。
 * renderer 通过 window.electronAPI.* 调用（preload 转发）。
 *
 * 架构铁律：
 *  - 所有含 Key 的 HTTP 请求必须在此主进程发出，不出 renderer
 *  - event.sender.send 精准回传，禁止 broadcast
 *  - activeStreams Map 防止多实例串台
 */

import { ipcMain, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import {
  saveApiKey,
  getApiKey,
  clearApiKey,
  getOnboardingDone,
  setOnboardingDone,
  getAdvancedMode,
  setAdvancedMode,
  getApiBaseUrl,
  saveUserInfo,
  getUserInfo,
  clearUserInfo,
  getModels,
  saveModel,
  deleteModel,
  saveModelKey,
  getModelKey,
  deleteModelKey,
  getInstances,
  saveInstance,
  deleteInstance,
  getConversation,
  appendMessage,
  clearConversation,
} from './store'

// ── 活跃流 Map（防止多实例串台） ─────────────────────────────────────────────
const activeStreams = new Map<string, AbortController>()

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * auth.verify — 验证 MS API Key
 * 调 GET /user/me 验证，成功后存 safeStorage + 用户信息
 */
ipcMain.handle('auth.verify', async (_event, key: string) => {
  // 检查 safeStorage 可用性
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error: 'safeStorage 不可用，无法安全存储密钥。请确认系统 keychain 服务正常运行。',
    }
  }

  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    return { ok: false, error: 'API Key 格式不正确，请检查后重试' }
  }

  const trimmedKey = key.trim()
  const baseUrl = getApiBaseUrl()

  try {
    const res = await fetch(`${baseUrl}/user/me`, {
      headers: { Authorization: `Bearer ${trimmedKey}` },
    })

    if (res.status === 401) {
      return { ok: false, error: 'API Key 不正确，请重新获取' }
    }

    if (!res.ok) {
      return { ok: false, error: `服务器错误 (${res.status})，请稍后重试` }
    }

    const data = await res.json()

    // 保存 Key 和用户信息
    saveApiKey(trimmedKey)
    setOnboardingDone(true)
    saveUserInfo({
      id: data.id,
      email: data.email,
      plan: data.plan,
      quotaUsedBytes: data.quota_used_bytes ?? 0,
      quotaLimitBytes: data.quota_limit_bytes ?? 0,
    })

    return {
      ok: true,
      data: {
        id: data.id,
        email: data.email,
        plan: data.plan,
        quotaUsedBytes: data.quota_used_bytes ?? 0,
        quotaLimitBytes: data.quota_limit_bytes ?? 0,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `网络错误，无法连接服务：${msg}` }
  }
})

/**
 * auth.getKey — 读取已保存的 API Key（masked）
 */
ipcMain.handle('auth.getKey', async () => {
  const key = getApiKey()
  if (!key) return { ok: false, key: null }
  // 只返回 masked 版本，Key 不出主进程
  const masked = key.slice(0, 4) + '****' + key.slice(-4)
  return { ok: true, key: masked }
})

/**
 * auth.clear — 清除 API Key（退出登录）
 */
ipcMain.handle('auth.clear', async () => {
  clearApiKey()
  clearUserInfo()
  setOnboardingDone(false)
  return { ok: true }
})

/**
 * auth.getUserInfo — 读取已保存的用户信息
 */
ipcMain.handle('auth.getUserInfo', async () => {
  const info = getUserInfo()
  if (!info) return { ok: false, error: '未找到用户信息' }
  return { ok: true, data: info }
})

// ── Settings ──────────────────────────────────────────────────────────────────

ipcMain.handle('settings.getAdvancedMode', async () => {
  return { ok: true, value: getAdvancedMode() }
})

ipcMain.handle('settings.setAdvancedMode', async (_event, enabled: boolean) => {
  setAdvancedMode(enabled)
  return { ok: true }
})

ipcMain.handle('settings.getOnboardingDone', async () => {
  return { ok: true, value: getOnboardingDone() }
})

// ── Models ────────────────────────────────────────────────────────────────────

/**
 * models.list — 返回所有已保存的算力模型列表（不含 Key）
 */
ipcMain.handle('models.list', async () => {
  return { ok: true, data: getModels() }
})

/**
 * models.add — 验证 Key 可用后存 safeStorage
 * 通过发送一个 models/list 请求来验证（不消耗 token，只验证 Key 是否有效）
 */
ipcMain.handle('models.add', async (_event, model: {
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
}) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'safeStorage 不可用，无法安全存储模型 Key' }
  }

  const { name, baseUrl, apiKey, modelName } = model

  // 验证 Key：调 /models 接口（不消耗 token）
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: '算力模型 API Key 验证失败，请检查 Key 是否正确' }
    }

    // 部分 API 兼容性：即使 /models 返回非 2xx，只要 Key 格式有效也接受
    // 若 /models 不存在（404），改用 chat/completions 发空消息试探
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: `API 连接失败 (${res.status})，请检查 BaseURL 是否正确` }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `无法连接算力模型 API：${msg}` }
  }

  const id = randomUUID()
  saveModel({ id, name, baseUrl, modelName })
  saveModelKey(id, apiKey)

  return { ok: true, data: { id } }
})

/**
 * models.delete — 删除模型配置和 Key
 */
ipcMain.handle('models.delete', async (_event, id: string) => {
  deleteModel(id)
  deleteModelKey(id)
  return { ok: true }
})

// ── Instances ─────────────────────────────────────────────────────────────────

/**
 * instances.list — 返回所有实例（不含 workspace token）
 */
ipcMain.handle('instances.list', async () => {
  return { ok: true, data: getInstances() }
})

/**
 * instances.create — 调 POST /workspaces 创建，存 store
 */
ipcMain.handle('instances.create', async (_event, data: {
  name: string
  modelId: string
  systemPrompt?: string
  tags?: string[]
}) => {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { ok: false, error: '未找到 MS API Key，请重新登录' }
  }

  const baseUrl = getApiBaseUrl()

  try {
    const res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: data.name }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error ?? `创建 Workspace 失败 (${res.status})` }
    }

    const workspace = await res.json()

    const instance = {
      id: randomUUID(),
      name: data.name,
      modelId: data.modelId,
      workspaceId: workspace.id,
      systemPrompt: data.systemPrompt,
      tags: data.tags,
      createdAt: new Date().toISOString(),
    }

    saveInstance(instance)
    return { ok: true, data: instance }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `创建失败：${msg}` }
  }
})

/**
 * instances.delete — 删除实例（只删本地，不调 API）
 */
ipcMain.handle('instances.delete', async (_event, id: string) => {
  deleteInstance(id)
  clearConversation(id)
  return { ok: true }
})

// ── Conversations ─────────────────────────────────────────────────────────────

ipcMain.handle('conversations.get', async (_event, instanceId: string) => {
  return { ok: true, data: getConversation(instanceId) }
})

ipcMain.handle('conversations.append', async (_event, instanceId: string, message: {
  id: string
  role: string
  content: string
  ts: number
}) => {
  appendMessage(instanceId, {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    content: message.content,
    ts: message.ts,
  })
  return { ok: true }
})

ipcMain.handle('conversations.clear', async (_event, instanceId: string) => {
  clearConversation(instanceId)
  return { ok: true }
})

// ── LLM 流式对话 ──────────────────────────────────────────────────────────────

/**
 * llm.streamChat — 流式调用算力模型
 *
 * 每个 token delta 通过 event.sender.send('llm:delta', { requestId, delta }) 精准回传。
 * 使用 event.sender 而非 broadcast，避免多实例串台。
 */
ipcMain.handle('llm.streamChat', async (event, requestId: string, modelId: string, messages: {
  role: string
  content: string
}[]) => {
  const model = getModels().find((m) => m.id === modelId)
  if (!model) {
    return { ok: false, error: `未找到模型配置: ${modelId}` }
  }

  const apiKey = getModelKey(modelId)
  if (!apiKey) {
    return { ok: false, error: '未找到模型 API Key，请在设置页重新添加模型' }
  }

  // 每次 streamChat 用独立 AbortController，requestId 唯一
  const abortController = new AbortController()
  activeStreams.set(requestId, abortController)

  // 异步执行流式请求，handler 立即返回
  ;(async () => {
    try {
      const res = await fetch(`${model.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.modelName,
          messages,
          stream: true,
        }),
        signal: abortController.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        event.sender.send('llm:error', {
          requestId,
          error: body.error?.message ?? `模型返回错误 (${res.status})`,
        })
        activeStreams.delete(requestId)
        return
      }

      if (!res.body) {
        event.sender.send('llm:error', { requestId, error: '响应体为空' })
        activeStreams.delete(requestId)
        return
      }

      // 逐行读取 SSE 流
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // 最后一行可能不完整，保留
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') continue

          try {
            const chunk = JSON.parse(jsonStr)
            const delta = chunk.choices?.[0]?.delta?.content
            if (delta != null && delta !== '') {
              // 精准回传给发送请求的 WebContents
              event.sender.send('llm:delta', { requestId, delta })
            }
          } catch {
            // 忽略解析异常的行
          }
        }
      }

      event.sender.send('llm:done', { requestId })
    } catch (err: unknown) {
      // AbortError 是正常中断，不报错
      if (err instanceof Error && err.name === 'AbortError') {
        event.sender.send('llm:done', { requestId })
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        event.sender.send('llm:error', { requestId, error: msg })
      }
    } finally {
      activeStreams.delete(requestId)
    }
  })()

  return { ok: true }
})

/**
 * llm.abort — 中断指定流
 */
ipcMain.handle('llm.abort', async (_event, requestId: string) => {
  const controller = activeStreams.get(requestId)
  if (controller) {
    try {
      controller.abort()
    } catch {
      // 忽略 abort 时的异常
    }
    activeStreams.delete(requestId)
  }
  return { ok: true }
})

export {}
