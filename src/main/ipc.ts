/**
 * ipc.ts — IPC handler 注册（白名单模式）
 *
 * 所有带 API Key 的 HTTP 请求在此发出，Key 不出主进程。
 * renderer 通过 window.electronAPI.* 调用（preload 转发）。
 */

import { ipcMain, safeStorage, WebContents } from 'electron'
import { randomUUID } from 'crypto'
import {
  saveApiKey, getApiKey, clearApiKey,
  saveUserInfo, getUserInfo,
  getModels, saveModel, deleteModel, getModelKey, saveModelKey,
  getInstances, newInstance, deleteInstance,
  getConversation, appendMessage, updateLastAssistantMessage,
  getOnboardingDone, setOnboardingDone,
  getAdvancedMode, setAdvancedMode,
  getApiBaseUrl,
  ModelConfig,
} from './store'

// ── 流管理 ────────────────────────────────────────────────────────────────────

/** 正在进行的流：requestId → AbortController */
const activeStreams = new Map<string, AbortController>()

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function safeSend(sender: WebContents, channel: string, data: unknown): void {
  if (!sender.isDestroyed()) {
    sender.send(channel, data)
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

ipcMain.handle('auth.verify', async (_event, key: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: '系统加密不可用，无法安全存储 API Key' }
  }
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    return { ok: false, error: 'API Key 格式不正确' }
  }
  const trimmed = key.trim()
  const baseUrl = getApiBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/user/me`, {
      headers: { Authorization: `Bearer ${trimmed}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { ok: false, error: 'API Key 不正确，请重新获取' }
    }
    const data = await res.json() as { email: string; plan: string }
    saveApiKey(trimmed)
    saveUserInfo({ email: data.email, plan: data.plan })
    setOnboardingDone(true)
    return { ok: true, email: data.email, plan: data.plan }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('timeout') || msg.includes('abort')) {
      return { ok: false, error: '连接超时，请检查网络' }
    }
    return { ok: false, error: '网络错误，请检查连接' }
  }
})

ipcMain.handle('auth.getKey', async () => {
  const key = getApiKey()
  if (!key) return { ok: false, key: null }
  const masked = key.slice(0, 4) + '****' + key.slice(-4)
  return { ok: true, key: masked }
})

ipcMain.handle('auth.clear', async () => {
  clearApiKey()
  setOnboardingDone(false)
  return { ok: true }
})

ipcMain.handle('auth.getUserInfo', async () => {
  return { ok: true, userInfo: getUserInfo() }
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

ipcMain.handle('models.list', async () => {
  return { ok: true, models: getModels() }
})

ipcMain.handle('models.add', async (_event, data: {
  name: string; baseUrl: string; apiKey: string; modelName: string
}) => {
  const { name, baseUrl, apiKey, modelName } = data
  if (!name || !baseUrl || !apiKey || !modelName) {
    return { ok: false, error: '所有字段均为必填' }
  }
  // 测试连接：发一个最小请求验证 Key 可用
  try {
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    })
    // 401/403 = Key 错误
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'API Key 验证失败，请检查' }
    }
    // 404 = 模型名或路径错误
    if (res.status === 404) {
      return { ok: false, error: '模型名称或 Base URL 不正确' }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('timeout') || msg.includes('abort')) {
      return { ok: false, error: '连接超时，请检查 Base URL' }
    }
    return { ok: false, error: '无法连接到模型服务，请检查 Base URL' }
  }

  const id = randomUUID()
  const model: ModelConfig = { id, name, baseUrl: baseUrl.replace(/\/$/, ''), modelName }
  saveModel(model)
  saveModelKey(id, apiKey)
  return { ok: true, model }
})

ipcMain.handle('models.delete', async (_event, id: string) => {
  deleteModel(id)
  return { ok: true }
})

// ── Instances ─────────────────────────────────────────────────────────────────

ipcMain.handle('instances.list', async () => {
  return { ok: true, instances: getInstances() }
})

ipcMain.handle('instances.create', async (_event, data: {
  name: string; modelId: string; systemPrompt?: string; tags?: string[]
}) => {
  const msKey = getApiKey()
  if (!msKey) return { ok: false, error: '未找到 MS API Key，请重新登录' }
  const baseUrl = getApiBaseUrl()

  // 调 memcore-api 创建 workspace
  try {
    const res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${msKey}`,
      },
      body: JSON.stringify({ name: data.name }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      return { ok: false, error: err.error ?? '创建实例失败，请重试' }
    }
    const ws = await res.json() as { id: string }
    const instance = newInstance({
      name: data.name,
      modelId: data.modelId,
      workspaceId: ws.id,
      systemPrompt: data.systemPrompt,
      tags: data.tags,
    })
    return { ok: true, instance }
  } catch {
    return { ok: false, error: '网络错误，请检查连接' }
  }
})

ipcMain.handle('instances.delete', async (_event, id: string) => {
  deleteInstance(id)
  return { ok: true }
})

// ── Conversations ─────────────────────────────────────────────────────────────

ipcMain.handle('conversations.get', async (_event, instanceId: string) => {
  return { ok: true, messages: getConversation(instanceId) }
})

// ── LLM 流式推理 ──────────────────────────────────────────────────────────────

ipcMain.handle('llm.streamChat', async (event, data: {
  requestId: string
  instanceId: string
  modelId: string
  messages: Array<{ role: string; content: string }>
  systemPrompt?: string
}) => {
  const { requestId, instanceId, modelId, messages, systemPrompt } = data

  // requestId 唯一性检查
  if (activeStreams.has(requestId)) {
    return { ok: false, error: 'DUPLICATE_REQUEST_ID' }
  }

  const modelKey = getModelKey(modelId)
  if (!modelKey) {
    return { ok: false, error: '找不到模型 Key，请在设置页重新添加模型' }
  }

  const models = getModels()
  const model = models.find((m) => m.id === modelId)
  if (!model) {
    return { ok: false, error: '找不到模型配置' }
  }

  const controller = new AbortController()
  activeStreams.set(requestId, controller)

  const sender = event.sender

  // 构造消息列表（可选 system prompt）
  const fullMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt })
  }
  fullMessages.push(...messages)

  // 记录用户消息
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUserMsg) {
    appendMessage(instanceId, { role: 'user', content: lastUserMsg.content, ts: Date.now() })
  }

  // 占位 assistant 消息（流式追加）
  appendMessage(instanceId, { role: 'assistant', content: '', ts: Date.now() })

  // 发起流式请求（在后台运行，不 await）
  ;(async () => {
    let accumulated = ''
    try {
      const url = model.baseUrl + '/chat/completions'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelKey}`,
        },
        body: JSON.stringify({
          model: model.modelName,
          messages: fullMessages,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        activeStreams.delete(requestId)
        safeSend(sender, 'llm:error', { requestId, error: `模型返回错误 ${res.status}: ${errText.slice(0, 100)}` })
        return
      }

      if (!res.body) {
        activeStreams.delete(requestId)
        safeSend(sender, 'llm:error', { requestId, error: '模型返回空响应' })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue
          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              accumulated += delta
              safeSend(sender, 'llm:delta', { requestId, delta })
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }

      // 更新存储中的 assistant 消息
      updateLastAssistantMessage(instanceId, accumulated)
      activeStreams.delete(requestId)
      safeSend(sender, 'llm:done', { requestId })
    } catch (e: unknown) {
      activeStreams.delete(requestId)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort') || msg.includes('AbortError')) {
        // 用户主动取消，不报错
        safeSend(sender, 'llm:error', { requestId, error: 'ABORTED' })
      } else {
        safeSend(sender, 'llm:error', { requestId, error: msg })
      }
    }
  })()

  return { ok: true }
})

ipcMain.handle('llm.abort', async (_event, requestId: string) => {
  const controller = activeStreams.get(requestId)
  if (controller) {
    try {
      controller.abort()
    } catch {
      // 已 destroy，忽略
    }
    activeStreams.delete(requestId)
  }
  return { ok: true }
})

export { activeStreams }
