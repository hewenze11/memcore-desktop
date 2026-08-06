/**
 * Main.tsx — 主界面
 * 微信电脑版风格：左侧实例列表 + 右侧聊天区
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InstanceConfig, ModelConfig, ChatMessage } from '../types'
import MemoryStatusBar, { type MemoryStatus } from '../components/MemoryStatusBar'

// ── 高级模式：记忆上下文审查面板 ─────────────────────────────────────────────

interface AdvancedPanelProps {
  memoryContext: string
  supplementInstr: string
  onConfirm: (editedContext: string) => void
  onCancel: () => void
  onRegenerate: (extraInstr: string) => void
}

function AdvancedPanel({ memoryContext, supplementInstr, onConfirm, onCancel, onRegenerate }: AdvancedPanelProps) {
  const [editedCtx, setEditedCtx] = useState(memoryContext)
  const [extraInstr, setExtraInstr] = useState('')

  return (
    <div className="border-t border-amber-200 bg-amber-50 flex-shrink-0 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
          ⚡ 记忆上下文
          {supplementInstr && (
            <span className="ml-1 text-[10px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full">
              含补充指令
            </span>
          )}
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          取消
        </button>
      </div>

      {/* 记忆上下文可编辑区 */}
      <textarea
        value={editedCtx}
        onChange={(e) => setEditedCtx(e.target.value)}
        rows={4}
        placeholder="（此处无记忆上下文，将直连算力模型）"
        className="w-full text-xs border border-amber-200 bg-white rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-amber-400 resize-none text-gray-700 leading-relaxed"
      />

      {/* 补充指令输入 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={extraInstr}
          onChange={(e) => setExtraInstr(e.target.value)}
          placeholder="补充召回指令（如：重点关注最近的工作记录）"
          className="flex-1 text-xs border border-amber-200 bg-white rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-amber-400 text-gray-700"
        />
        <button
          onClick={() => { if (extraInstr.trim()) onRegenerate(extraInstr.trim()) }}
          disabled={!extraInstr.trim()}
          className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          重新生成
        </button>
      </div>

      {/* 确认发送 */}
      <button
        onClick={() => onConfirm(editedCtx)}
        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
      >
        用此上下文发送
      </button>
    </div>
  )
}

// ── 新建实例弹窗 ──────────────────────────────────────────────────────────────

interface NewInstanceModalProps {
  models: ModelConfig[]
  onClose: () => void
  onCreated: (instance: InstanceConfig) => void
}

function NewInstanceModal({ models, onClose, onCreated }: NewInstanceModalProps) {
  const [name, setName] = useState('')
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('请输入实例名称'); return }
    if (!modelId) { setError('请选择算力模型'); return }
    setLoading(true)
    setError('')
    try {
      const res = await window.electronAPI.instances.create({
        name: name.trim(),
        modelId,
        systemPrompt: systemPrompt.trim() || undefined,
      })
      if (res.ok && res.instance) {
        onCreated(res.instance)
      } else {
        setError(res.error ?? '创建失败，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-800">新建实例</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">实例名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：工作助手"
              autoFocus
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">算力模型 *</label>
            {models.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2.5 rounded-xl">
                请先在设置页添加算力模型
              </p>
            ) : (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.modelName}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">常驻提示词（可选）</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="如：你是一位严谨的技术顾问..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || models.length === 0}
              className="flex-1 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  )
}

// ── 消息气泡 ──────────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
        }`}
      >
        {msg.content || (msg.streaming ? <span className="opacity-50">▍</span> : null)}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function Main() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<InstanceConfig[]>([])
  const [models, setModels] = useState<ModelConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [toast, setToast] = useState('')
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>('idle')

  // ── M3：高级模式状态 ───────────────────────────────────────────────────────
  const [advancedMode, setAdvancedMode] = useState(false)
  /** awaitingConfirm：召回完成，等用户审查/确认 */
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  /** 当前召回到的记忆上下文（可编辑） */
  const [memoryContext, setMemoryContext] = useState('')
  /** 临时补充指令（累积追加，发送后清空） */
  const [supplementInstr, setSupplementInstr] = useState('')
  /** 缓存待发送的用户消息（recall 完成后才真正发出） */
  const pendingUserContentRef = useRef<string | null>(null)
  /** 版本号：每次发起 recall 自增，取消时也自增；订阅里校验，过期事件直接丢弃 */
  const recallVersionRef = useRef(0)
  /** recall watchdog timer：30s 后若 recallDone 未收到，自动降级释放 sending */
  const recallWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 订阅记忆状态事件（只处理当前选中实例的事件，防止跨实例污染）
  useEffect(() => {
    const cleanup = window.electronAPI.memory.onStatus((data) => {
      // instanceId 不匹配时忽略（主进程会携带 instanceId）
      if (data.instanceId && data.instanceId !== selectedId) return

      // 版本号校验：recallDone/degraded(advancedMode) 必须匹配当前版本，
      // 否则是取消后的过期回调，直接丢弃
      if ((data.status === 'recallDone' || (data.status === 'degraded' && data.advancedMode))
          && data.recallVersion !== undefined
          && data.recallVersion !== recallVersionRef.current) {
        return
      }

      if (data.status === 'recalling') setMemoryStatus('recalling')
      else if (data.status === 'recallDone') {
        // 收到 recallDone，清除 watchdog
        if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
        setMemoryStatus('idle')
        if (data.context !== undefined) {
          setMemoryContext(data.context)
          setAwaitingConfirm(true)
          setSending(false)
        }
      }
      else if (data.status === 'degraded') {
        if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
        setMemoryStatus('degraded')
        setTimeout(() => setMemoryStatus('idle'), 5000)
        if (data.advancedMode) {
          setMemoryContext('')
          setAwaitingConfirm(true)
          setSending(false)
        }
      }
      else if (data.status === 'archived') {
        setMemoryStatus('archived')
        setTimeout(() => setMemoryStatus('idle'), 3000)
      } else if (data.status === 'queued') {
        setMemoryStatus('queued')
        setTimeout(() => setMemoryStatus('idle'), 8000)
      } else {
        console.warn('[memory:status] unknown status:', data.status)
      }
    })
    return cleanup
  }, [selectedId])

  // 加载实例和模型列表
  const reload = useCallback(async () => {
    const [instRes, modelRes] = await Promise.all([
      window.electronAPI.instances.list(),
      window.electronAPI.models.list(),
    ])
    if (instRes.ok) setInstances(instRes.instances)
    if (modelRes.ok) setModels(modelRes.models)
  }, [])

  useEffect(() => { reload() }, [reload])

  // 切换实例时加载对话历史
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    window.electronAPI.conversations.get(selectedId).then((res) => {
      if (res.ok) setMessages(res.messages)
    })
  }, [selectedId])

  // 自动滚到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedInstance = instances.find((i) => i.id === selectedId) ?? null
  const selectedModel = models.find((m) => m.id === selectedInstance?.modelId) ?? null

  /**
   * 底层发起流式推理（普通模式 or 高级模式确认后调用）
   * overrideContext: 高级模式用户编辑后的记忆上下文
   */
  const doStreamChat = async (userContent: string, overrideContext?: string) => {
    if (!selectedId || !selectedInstance || !selectedModel) return

    const requestId = globalThis.crypto.randomUUID()
    currentRequestIdRef.current = requestId

    const userMsg: ChatMessage = { role: 'user', content: userContent, ts: Date.now() }
    const assistantPlaceholder: ChatMessage & { streaming: boolean } = {
      role: 'assistant', content: '', ts: Date.now(), streaming: true
    }
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])

    let accumulated = ''
    const cleanup = window.electronAPI.llm.subscribe(
      requestId,
      (delta) => {
        accumulated += delta
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: accumulated, streaming: true }
          }
          return next
        })
      },
      () => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, streaming: false }
          }
          return next
        })
        setSending(false)
        cleanupRef.current = null
        currentRequestIdRef.current = null
      },
      (error) => {
        if (error !== 'ABORTED') setToast('发送失败：' + error)
        setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.content === '' && (m as any).streaming)))
        setSending(false)
        cleanupRef.current = null
        currentRequestIdRef.current = null
      }
    )
    cleanupRef.current = cleanup

    const history = messages
      .filter((m) => !((m as any).streaming && m.content === ''))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: userContent })

    const res = await window.electronAPI.llm.streamChat({
      requestId,
      instanceId: selectedId,
      modelId: selectedInstance.modelId,
      messages: history,
      systemPrompt: selectedInstance.systemPrompt,
      overrideContext,
      // 高级模式已拿到 context，跳过主进程 recall
      skipRecall: overrideContext !== undefined,
    })

    if (!res.ok) {
      cleanup()
      cleanupRef.current = null
      currentRequestIdRef.current = null
      setToast(res.error ?? '发送失败')
      setMessages((prev) => prev.slice(0, -2))
      setSending(false)
    }
  }

  const handleSend = async () => {
    // 硬 gate：sending / awaitingConfirm 任意一个为 true 都拒绝（防并发、防快速重点）
    if (!input.trim() || sending || awaitingConfirm || !selectedId || !selectedInstance || !selectedModel) return

    // 先清理旧流
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    if (currentRequestIdRef.current) {
      window.electronAPI.llm.abort(currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }

    const userContent = input.trim()
    setInput('')
    setMemoryStatus('idle')

    if (advancedMode) {
      // 高级模式：先 recall-only，sending 保持 true 直到 awaitingConfirm 或失败
      pendingUserContentRef.current = userContent
      // 版本号自增，忽略过期 IPC 回调（取消后的 recallDone 不会触发）
      recallVersionRef.current += 1
      setSending(true)

      const currentVersion = recallVersionRef.current
      const res = await window.electronAPI.memory.recallOnly({
        instanceId: selectedId,
        userMessage: userContent,
        supplementInstr: supplementInstr || undefined,
        recallVersion: currentVersion,
      })
      if (!res.ok) {
        setMemoryContext('')
        setAwaitingConfirm(true)
        setSending(false)
        return
      }
      // recall 成功：sending 保持 true，等 recallDone 事件（带版本号）推入 awaitingConfirm
      // watchdog：30s 内若未收到 recallDone，自动降级释放 sending
      if (recallWatchdogRef.current) clearTimeout(recallWatchdogRef.current)
      recallWatchdogRef.current = setTimeout(() => {
        // 版本号仍匹配说明 recallDone 还没来，强制降级
        if (recallVersionRef.current === currentVersion) {
          setMemoryContext('')
          setAwaitingConfirm(true)
          setSending(false)
          setToast('记忆召回超时，请在面板中直接确认发送')
        }
      }, 30000)
    } else {
      // 普通模式：直接流式生成（主进程内 recall）
      setSending(true)
      await doStreamChat(userContent)
    }
  }

  /**
   * 高级模式：用户确认/编辑上下文后发送
   * editedContext: 用户编辑过的记忆上下文（传给主进程 overrideContext）
   */
  const handleConfirmAndGenerate = async (editedContext: string) => {
    const userContent = pendingUserContentRef.current
    if (!userContent) return

    setAwaitingConfirm(false)
    pendingUserContentRef.current = null
    setSupplementInstr('')  // 发送后清空临时补充指令
    setSending(true)

    try {
      await doStreamChat(userContent, editedContext)
    } catch (e) {
      // doStreamChat 内部自行 setToast，这里保证 sending 能被收回
      console.error('[confirmAndGenerate] unexpected error:', e)
      setSending(false)
    }
  }

  /** 高级模式：取消（回 idle，不归档） */
  const handleCancelAdvanced = () => {
    recallVersionRef.current += 1
    if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
    setAwaitingConfirm(false)
    setMemoryContext('')
    pendingUserContentRef.current = null
    setSending(false)
  }

  /** 高级模式：重新生成（带追加指令重新 recall） */
  const handleRegenerate = async (extraInstr: string) => {
    const userContent = pendingUserContentRef.current
    if (!userContent || !selectedId) return

    setAwaitingConfirm(false)
    setMemoryContext('')
    recallVersionRef.current += 1  // 本轮新 recall，自增版本
    setSending(true)

    // 追加本次指令（累积，不清空）
    const merged = supplementInstr ? `${supplementInstr}\n${extraInstr}` : extraInstr
    setSupplementInstr(merged)

    const currentVersion = recallVersionRef.current
    const res = await window.electronAPI.memory.recallOnly({
      instanceId: selectedId,
      userMessage: userContent,
      supplementInstr: merged || undefined,
      recallVersion: currentVersion,
    })
    if (!res.ok) {
      setMemoryContext('')
      setAwaitingConfirm(true)
      setSending(false)
      return
    }
    // recall 成功：保持 sending=true，等 recallDone 事件（带版本号）推入 awaitingConfirm
    if (recallWatchdogRef.current) clearTimeout(recallWatchdogRef.current)
    recallWatchdogRef.current = setTimeout(() => {
      if (recallVersionRef.current === currentVersion) {
        setMemoryContext('')
        setAwaitingConfirm(true)
        setSending(false)
        setToast('记忆召回超时，请在面板中直接确认发送')
      }
    }, 30000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 记录当前 requestId，切换实例时用来 abort 主进程流
  const currentRequestIdRef = useRef<string | null>(null)

  const handleSelectInstance = (id: string) => {
    // 切换实例：cleanup renderer listener + abort 主进程流
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (currentRequestIdRef.current) {
      window.electronAPI.llm.abort(currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }
    recallVersionRef.current += 1
    if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
    setSending(false)
    setMemoryStatus('idle')
    setAwaitingConfirm(false)
    setMemoryContext('')
    pendingUserContentRef.current = null
    setSelectedId(id)
  }

  const handleDeleteInstance = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electronAPI.instances.delete(id)
    if (selectedId === id) setSelectedId(null)
    reload()
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden select-none">
      {/* ── 左侧：实例列表 ──────────────────────────────────────────────── */}
      <aside className="flex flex-col w-[280px] min-w-[220px] border-r border-gray-100 bg-[#f7f7f7]">
        {/* 顶栏 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 px-3 py-1.5 bg-gray-200/60 rounded-lg">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="搜索" className="flex-1 bg-transparent text-xs text-gray-600 outline-none placeholder-gray-400" />
          </div>
          {/* 设置 */}
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60"
            title="设置"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* 实例列表 */}
        <div className="flex-1 overflow-y-auto">
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">暂无实例</p>
              <p className="text-xs text-gray-300 mt-1">点击下方按钮新建</p>
            </div>
          ) : (
            instances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => handleSelectInstance(inst.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors group ${
                  selectedId === inst.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {inst.name[0]}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 truncate">{inst.name}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(inst.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {models.find((m) => m.id === inst.modelId)?.name ?? '未知模型'}
                  </p>
                </div>
                {/* 删除按钮（hover 显示） */}
                <button
                  onClick={(e) => handleDeleteInstance(inst.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 flex-shrink-0 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>

        {/* 新建按钮 */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建实例
          </button>
        </div>
      </aside>

      {/* ── 右侧：聊天区 ─────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0">
        {selectedInstance ? (
          <>
            {/* 顶栏 */}
            <header className="flex items-center px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                {selectedInstance.name[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800 text-sm">{selectedInstance.name}</p>
                <p className="text-xs text-gray-400">{selectedModel?.name ?? ''}</p>
              </div>
              {/* ⚡ 高级模式开关 */}
              <button
                onClick={() => {
                  setAdvancedMode((v) => !v)
                  if (awaitingConfirm) handleCancelAdvanced()
                }}
                title={advancedMode ? '关闭高级模式' : '开启高级模式（记忆上下文审查）'}
                className={`p-1.5 rounded-lg text-base transition-colors ${
                  advancedMode
                    ? 'bg-amber-100 text-amber-500'
                    : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                }`}
              >
                ⚡
              </button>
            </header>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#f9f9f9]">
              {messages.length === 0 && (
                <div className="text-center text-xs text-gray-300 py-8">开始对话吧</div>
              )}
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 记忆状态栏 */}
            <MemoryStatusBar status={memoryStatus} />

            {/* ── 高级模式：记忆上下文审查侧边板（awaitingConfirm 时展开）── */}
            {awaitingConfirm && (
              <AdvancedPanel
                memoryContext={memoryContext}
                supplementInstr={supplementInstr}
                onConfirm={handleConfirmAndGenerate}
                onCancel={handleCancelAdvanced}
                onRegenerate={handleRegenerate}
              />
            )}

            {/* 输入区 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={awaitingConfirm ? '请先审查记忆上下文...' : '输入消息... (Enter 发送，Shift+Enter 换行)'}
                  rows={1}
                  disabled={sending || awaitingConfirm}
                  className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all max-h-32 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim() || awaitingConfirm}
                  className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-xl transition-colors"
                >
                  {sending ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : '发送'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
              <span className="text-indigo-600 text-3xl font-bold">M</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">欢迎使用 MemCore</h2>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              从左侧选择一个 AI 实例开始对话，或新建一个实例
            </p>
          </div>
        )}
      </main>

      {/* 新建实例弹窗 */}
      {showNewModal && (
        <NewInstanceModal
          models={models}
          onClose={() => setShowNewModal(false)}
          onCreated={(inst) => {
            setShowNewModal(false)
            reload()
            setSelectedId(inst.id)
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
