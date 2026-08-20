/**
 * memory.ts — 记忆相关操作（recall / archive / retryQueue）
 *
 * 所有请求都在主进程发出，MS API Key 不出主进程。
 */

import {
  getApiKey,
  getSupermodelUrl,
  enqueueArchive,
  removeFromQueue,
  incrementRetry,
  getArchiveQueue,
  ArchiveItem,
} from './store'

const RECALL_TIMEOUT_MS = 8000   // 超过 8s 触发降级
const MAX_RETRY_COUNT = 3

// ── Recall ────────────────────────────────────────────────────────────────────

export type RecallResult =
  | { ok: true; context: string }
  | { ok: false; reason: 'timeout' | 'service_error' | 'no_key' }

/**
 * 调 SuperModel memory-recall，返回记忆上下文字符串
 * 超时（>8s）或失败返回 { ok: false }，调用方降级直连算力模型
 */
export async function recall(params: {
  workspaceId: string
  userMessage: string
}): Promise<RecallResult> {
  const key = getApiKey()
  if (!key) return { ok: false, reason: 'no_key' }

  const supermodelUrl = getSupermodelUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RECALL_TIMEOUT_MS)

  try {
    const res = await fetch(`${supermodelUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'X-Workspace-ID': params.workspaceId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'memory-recall',
        messages: [{ role: 'user', content: params.userMessage }],
        stream: false,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return { ok: false, reason: 'service_error' }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const context = data.choices?.[0]?.message?.content ?? ''
    return { ok: true, context }
  } catch (e: unknown) {
    clearTimeout(timer)
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'service_error' }
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────

/**
 * 异步归档一轮对话（fire-and-forget）
 * 失败时入本地重试队列，下次启动或退出时自动重试
 */
export async function archiveAsync(item: ArchiveItem): Promise<'ok' | 'queued'> {
  try {
    await doArchive(item)
    return 'ok'
  } catch {
    enqueueArchive(item)
    return 'queued'
  }
}

async function doArchive(item: ArchiveItem): Promise<void> {
  const key = getApiKey()
  if (!key) throw new Error('NO_KEY')

  const supermodelUrl = getSupermodelUrl()
  const res = await fetch(`${supermodelUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'X-Workspace-ID': item.workspaceId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'memory-archive',
      messages: [
        { role: 'user', content: item.userContent },
        { role: 'assistant', content: item.assistantContent },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`archive_http_${res.status}`)
}

// ── RetryQueue ────────────────────────────────────────────────────────────────

let retryRunning = false

/**
 * flush 本地归档重试队列
 * 最多重试 MAX_RETRY_COUNT 次，超限丢弃
 * 在 app 启动时和 before-quit 时调用
 * 互斥锁保护：同一时刻只允许一个实例运行，防止并发重复归档
 */
export async function retryQueue(): Promise<void> {
  if (retryRunning) return
  retryRunning = true
  try {
  const queue = getArchiveQueue()

  for (const [instanceId, items] of Object.entries(queue)) {
    for (const item of [...items]) {
      if (item.retryCount >= MAX_RETRY_COUNT) {
        // 超限：丢弃，记录日志
        console.error('[retryQueue] give_up', { turnId: item.turnId, instanceId })
        removeFromQueue(instanceId, item.turnId)
        continue
      }
      try {
        await doArchive(item)
        removeFromQueue(instanceId, item.turnId)
      } catch {
        incrementRetry(instanceId, item.turnId)
      }
    }
  }
  } finally {
    retryRunning = false
  }
}
