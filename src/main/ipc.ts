/**
 * ipc.ts — IPC handler 注册（白名单模式）
 *
 * 所有带 API Key 的 HTTP 请求在此发出，Key 不出主进程。
 * renderer 通过 window.electronAPI.* 调用（preload 转发）。
 */

import { ipcMain, safeStorage, WebContents, dialog } from 'electron'
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
  ArchiveItem,
} from './store'
import { recall, archiveAsync } from './memory'

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
    // 拦截所有非成功响应
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'API Key 验证失败，请检查' }
      }
      if (res.status === 404) {
        return { ok: false, error: '模型名称或 Base URL 不正确' }
      }
      return { ok: false, error: `服务端错误 (${res.status})，请稍后重试` }
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

// ── 高级模式：仅 recall，结果通过 memory:status{recallDone} 事件推回 ──────────

ipcMain.handle('memory.recallOnly', async (event, data: {
  instanceId: string
  userMessage: string
  supplementInstr?: string
  recallVersion?: number
}) => {
  const { instanceId, userMessage, supplementInstr, recallVersion } = data
  const sender = event.sender

  const instances = getInstances()
  const instance = instances.find((i) => i.id === instanceId)
  if (!instance) return { ok: false, error: '实例不存在' }

  safeSend(sender, 'memory:status', { status: 'recalling', instanceId })

  // 构造 recall userMessage：原消息 + 补充指令
  const recallMessage = supplementInstr
    ? `${userMessage}\n\n[补充指令]\n${supplementInstr}`
    : userMessage

  const result = await recall({ workspaceId: instance.workspaceId, userMessage: recallMessage })

  if (result.ok) {
    safeSend(sender, 'memory:status', {
      status: 'recallDone',
      instanceId,
      context: result.context,
      recallVersion,  // 透传回 renderer 做版本号校验
    })
    return { ok: true }
  } else {
    safeSend(sender, 'memory:status', {
      status: 'degraded',
      instanceId,
      reason: result.reason,
      advancedMode: true,
      recallVersion,
    })
    return { ok: false, error: result.reason }
  }
})

// ── LLM 流式推理 ──────────────────────────────────────────────────────────────

ipcMain.handle('llm.streamChat', async (event, data: {
  requestId: string
  instanceId: string
  modelId: string
  messages: Array<{ role: string; content: string }>
  systemPrompt?: string
  /** 跳过记忆（高级模式用户手动指定上下文时传 true） */
  skipRecall?: boolean
  /** 高级模式：用户编辑过的记忆上下文（跳过 recall 直接注入） */
  overrideContext?: string
}) => {
  const { requestId, instanceId, modelId, messages, systemPrompt, skipRecall, overrideContext } = data
  // turnId 由主进程生成，不信任 renderer 传入（防伪造/碰撞）
  const turnId = randomUUID()

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

  // 查实例获取 workspaceId/sessionId（用于 recall/archive）
  const instances = getInstances()
  const instance = instances.find((i) => i.id === instanceId)

  const controller = new AbortController()
  activeStreams.set(requestId, controller)

  const sender = event.sender

  // ── Step 1：记忆召回（异步，8s 超时降级）──────────────────────────────────

  let memoryContext = ''
  let memoryStatus: 'ok' | 'degraded' | 'skipped' = 'skipped'

  if (instance && !skipRecall && !overrideContext) {
    // 通知 renderer 开始召回（携带 instanceId，防止跨实例污染）
    safeSend(sender, 'memory:status', { status: 'recalling', instanceId })

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const recallResult = await recall({
      workspaceId: instance.workspaceId,
      userMessage: lastUserMsg?.content ?? '',
    })

    if (recallResult.ok) {
      memoryContext = recallResult.context
      memoryStatus = 'ok'
    } else {
      // 超时或服务错误 → 降级直连算力模型
      memoryStatus = 'degraded'
      safeSend(sender, 'memory:status', { status: 'degraded', reason: recallResult.reason, instanceId })
    }
  } else if (overrideContext) {
    // 高级模式：用户编辑的上下文直接注入
    memoryContext = overrideContext
    memoryStatus = 'ok'
  }

  // ── Step 2：构造消息列表（system prompt + 记忆上下文）──────────────────────

  const fullMessages: Array<{ role: string; content: string }> = []
  let systemContent = systemPrompt ?? ''
  if (memoryContext) {
    systemContent = systemContent
      ? `${systemContent}\n\n---\n${memoryContext}`
      : memoryContext
  }
  if (systemContent) {
    fullMessages.push({ role: 'system', content: systemContent })
  }
  fullMessages.push(...messages)

  // 记录用户消息
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUserMsg) {
    appendMessage(instanceId, { role: 'user', content: lastUserMsg.content, ts: Date.now() })
  }

  // 占位 assistant 消息（流式追加）
  appendMessage(instanceId, { role: 'assistant', content: '', ts: Date.now() })

  // 固化此次请求的上下文（不信后续 payload 变化，防止 instanceId 串台）
  const boundInstanceId = instanceId
  const boundTurnId = turnId
  const boundInstance = instance ?? null
  const boundModelUrl = model.baseUrl + '/chat/completions'
  const boundModelName = model.modelName
  const boundLastUserContent = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  // 发起流式请求（在后台运行，不 await）
  ;(async () => {
    let accumulated = ''
    try {
      const res = await fetch(boundModelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelKey}`,
        },
        body: JSON.stringify({
          model: boundModelName,
          messages: fullMessages,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        // P0 修复：用结构化前缀传递错误类型，防止 renderer 正则误判模型输出内容
        // renderer 通过前缀判断错误类型，不做原始字符串正则匹配
        if (res.status === 401 || res.status === 403) {
          safeSend(sender, 'llm:error', { requestId, error: 'AUTH_FAIL' })
        } else if (res.status >= 500) {
          safeSend(sender, 'llm:error', { requestId, error: 'SERVER_ERROR' })
        } else {
          safeSend(sender, 'llm:error', { requestId, error: `REQUEST_FAIL_${res.status}` })
        }
        return
      }

      if (!res.body) {
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

      // 用固化的 instanceId 写入（防止串台）
      updateLastAssistantMessage(boundInstanceId, accumulated)
      safeSend(sender, 'llm:done', { requestId })

      // ── Step 3：异步归档（fire-and-forget）──────────────────────────────
      if (boundInstance && accumulated && boundLastUserContent) {
        const archiveItem: ArchiveItem = {
          turnId: boundTurnId,
          instanceId: boundInstanceId,
          workspaceId: boundInstance.workspaceId,
          sessionId: boundInstance.sessionId,
          userContent: boundLastUserContent,
          assistantContent: accumulated,
          retryCount: 0,
          createdAt: Date.now(),
        }
        archiveAsync(archiveItem).then((result) => {
          safeSend(sender, 'memory:status', {
            status: result === 'ok' ? 'archived' : 'queued',
            instanceId: boundInstanceId,
          })
        }).catch((err) => {
          console.error('[archive] unexpected error:', err)
          safeSend(sender, 'memory:status', { status: 'queued', instanceId: boundInstanceId })
        })
      }
    } catch (e: unknown) {
      // 用 error.name 判断 abort，不依赖字符串
      if (e instanceof Error && e.name === 'AbortError') {
        safeSend(sender, 'llm:error', { requestId, error: 'ABORTED' })
      } else {
        safeSend(sender, 'llm:error', { requestId, error: e instanceof Error ? e.message : String(e) })
      }
    } finally {
      // finally 确保 activeStreams 在所有路径下都清理
      activeStreams.delete(requestId)
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

// ── M4：记忆空间（Memory Space）──────────────────────────────────────────────
// 所有请求需要 API Key，通过主进程代理，Key 不出 renderer

/**
 * renderer 被允许访问的 API 路径前缀白名单（P0 安全修复）
 * 所有条目末尾必须带 /，防止 /memory/docs-evil 等前缀混淆攻击
 */
const MEMSPACE_PATH_ALLOWLIST = [
  '/memory/docs/',
  '/memory/tags/',
  '/memory/messages/',
  '/memory/recent/',
  '/memory/search/',
  '/memory/semantic/',
  '/workspaces/',
]

/** 精确路径（无尾斜杠）也允许，如 GET /memory/recent */
const MEMSPACE_EXACT_PATHS = [
  '/memory/docs',
  '/memory/tags',
  '/memory/recent',
  '/memory/search',
  '/memory/semantic',
]

function isAllowedMemspacePath(path: string): boolean {
  if (typeof path !== 'string' || path.length > 512) return false

  // F1 修复：先 decode 再检查，防止 %2F..%2F 等 URL 编码路径穿越
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false // 非法 percent-encoding 直接拒绝
  }

  // 禁止路径遍历、协议前缀（大小写不敏感）、控制字符、双斜杠
  if (/\.\./i.test(decoded)) return false
  if (/^https?:/i.test(decoded)) return false
  if (/[\x00-\x1F]|\/\//.test(decoded)) return false

  // P2 修复：path 段不应在 decode 后仍含 %XX（防二次编码绕过）
  // query string 部分（? 后）允许中文等编码，只检查路径段
  const pathSegment = decoded.split('?')[0]
  if (/%[0-9a-fA-F]{2}/.test(pathSegment)) return false

  // F2 修复：allowlist 末尾带 / 防前缀混淆，同时允许精确路径（不带尾 /）
  return (
    MEMSPACE_PATH_ALLOWLIST.some((prefix) => decoded.startsWith(prefix)) ||
    MEMSPACE_EXACT_PATHS.includes(pathSegment)
  )
}

ipcMain.handle('memspace.request', async (_event, data: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
}) => {
  const { method, path, body } = data
  const key = getApiKey()
  if (!key) return { ok: false, error: 'NO_KEY' }

  // P0 修复：路径白名单，防止 renderer 借主进程 Key 访问任意后端接口
  if (!isAllowedMemspacePath(path)) {
    return { ok: false, error: 'PATH_NOT_ALLOWED' }
  }

  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      // P2 修复：GET/HEAD 不传 body（语义不规范）
      body: (method !== 'GET' && method !== 'HEAD' && body !== undefined)
        ? JSON.stringify(body)
        : undefined,
      signal: AbortSignal.timeout(15000),
    })

    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }

    return { ok: res.ok, status: res.status, data: json }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
})

// ── Dialog ────────────────────────────────────────────────────────────────────
// Electron renderer 的 confirm() 不可靠（可能直接返回 false），统一走主进程 dialog

ipcMain.handle('dialog.confirm', async (_event, message: string) => {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['取消', '确认删除'],
    defaultId: 0,
    cancelId: 0,
    message: typeof message === 'string' ? message : '确认执行此操作？',
  })
  return response === 1
})

// ── Shell ──────────────────────────────────────────────────────────────────────
import { shell } from 'electron'
ipcMain.handle('shell.openExternal', async (_event, url: string) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url)
    return { ok: true }
  }
  return { ok: false, error: 'Invalid URL' }
})

export { activeStreams }
