/**
 * Main.tsx — 主界面
 *
 * 布局：左侧实例列表 + 右侧聊天区
 * 功能：
 *  - 实例列表（从 instances.list 读取，实时渲染）
 *  - 新建实例弹窗（Modal）：填名称 + 选算力模型（下拉）
 *  - 右侧聊天区：消息历史渲染，流式输出
 *  - Enter 发送，Shift+Enter 换行
 *  - 流式输出期间禁用输入
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Instance, Message, Model, UserInfo } from '../types'

// ── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const counterRef = useRef(0)

  const show = useCallback((message: string, type: ToastState['type'] = 'error') => {
    const id = ++counterRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return { toasts, show }
}

// ── 新建实例弹窗 ──────────────────────────────────────────────────────────────

interface CreateInstanceModalProps {
  models: Model[]
  onClose: () => void
  onCreated: (instance: Instance) => void
}

function CreateInstanceModal({ models, onClose, onCreated }: CreateInstanceModalProps) {
  const [name, setName] = useState('')
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasModels = models.length > 0

  const handleCreate = async () => {
    if (!name.trim()) { setError('请输入实例名称'); return }
    if (!modelId) { setError('请选择算力模型'); return }

    setLoading(true)
    setError('')
    try {
      const res = await window.electronAPI.instances.create({ name: name.trim(), modelId })
      if (res.ok && res.data) {
        onCreated(res.data as Instance)
      } else {
        setError(res.error ?? '创建失败，请重试')
      }
    } catch {
      setError('创建出错，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 mx-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4">新建 AI 实例</h2>

        <div className="space-y-3">
          {/* 实例名称 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">实例名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && hasModels) handleCreate() }}
              placeholder="例如：写作助手"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
            />
          </div>

          {/* 算力模型选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">算力模型</label>
            {hasModels ? (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}（{m.modelName}）
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl">
                请先在设置页添加算力模型
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !hasModels}
            className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl transition-colors"
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 消息气泡 ──────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
          M
        </div>
      )}
      <div
        className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1 h-4 bg-indigo-500 ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </p>
      </div>
    </div>
  )
}

// ── Main 组件 ─────────────────────────────────────────────────────────────────

export default function Main() {
  const navigate = useNavigate()
  const { toasts, show: showToast } = useToast()

  // 实例列表
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 模型列表
  const [models, setModels] = useState<Model[]>([])

  // 用户信息
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  // 消息历史（当前实例）
  const [messages, setMessages] = useState<Message[]>([])

  // 流式输出状态
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // 输入框
  const [inputText, setInputText] = useState('')

  // 新建实例弹窗
  const [showCreateModal, setShowCreateModal] = useState(false)

  // 消息列表滚动
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 当前正在进行的 streamChat requestId
  const currentRequestIdRef = useRef<string | null>(null)

  // ── 初始化加载 ───────────────────────────────────────────────────────────

  useEffect(() => {
    // 加载实例列表
    window.electronAPI.instances.list().then((res) => {
      if (res.ok && res.data) setInstances(res.data as Instance[])
    })

    // 加载模型列表
    window.electronAPI.models.list().then((res) => {
      if (res.ok && res.data) setModels(res.data as Model[])
    })

    // 加载用户信息
    window.electronAPI.auth.getUserInfo().then((res) => {
      if (res.ok && res.data) setUserInfo(res.data as UserInfo)
    })
  }, [])

  // ── 切换实例时加载历史消息 ───────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    window.electronAPI.conversations.get(selectedId).then((res) => {
      if (res.ok && res.data) setMessages(res.data as Message[])
      else setMessages([])
    })
  }, [selectedId])

  // ── 消息列表自动滚动到底部 ───────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 订阅 LLM 流事件 ──────────────────────────────────────────────────────

  useEffect(() => {
    const cleanupDelta = window.electronAPI.llm.onDelta((payload) => {
      // requestId 过滤，防止多实例串台
      if (payload.requestId !== currentRequestIdRef.current) return

      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        // 追加 delta 到最后一条 assistant 消息
        const updated: Message = { ...last, content: last.content + payload.delta }
        return [...prev.slice(0, -1), updated]
      })
    })

    const cleanupDone = window.electronAPI.llm.onDone((payload) => {
      if (payload.requestId !== currentRequestIdRef.current) return
      setIsStreaming(false)
      setStreamingMessageId(null)
      currentRequestIdRef.current = null

      // 持久化最终消息（最后一条 assistant 消息）
      if (selectedId) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            window.electronAPI.conversations.append(selectedId, last)
          }
          return prev
        })
      }
    })

    const cleanupError = window.electronAPI.llm.onError((payload) => {
      if (payload.requestId !== currentRequestIdRef.current) return
      setIsStreaming(false)
      setStreamingMessageId(null)
      currentRequestIdRef.current = null

      // 移除空的 assistant 消息占位
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.content === '') {
          return prev.slice(0, -1)
        }
        return prev
      })

      showToast(`回复出错：${payload.error}`)
    })

    return () => {
      cleanupDelta()
      cleanupDone()
      cleanupError()
    }
  }, [selectedId, showToast])

  // ── 发送消息 ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!selectedId || !inputText.trim() || isStreaming) return

    const instance = instances.find((i) => i.id === selectedId)
    if (!instance) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputText.trim(),
      ts: Date.now(),
    }

    // 先持久化用户消息
    await window.electronAPI.conversations.append(selectedId, userMsg)

    // 添加用户消息 + assistant 占位
    const assistantMsgId = crypto.randomUUID()
    const assistantPlaceholder: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      ts: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
    setInputText('')
    setIsStreaming(true)
    setStreamingMessageId(assistantMsgId)

    // 生成唯一 requestId
    const requestId = crypto.randomUUID()
    currentRequestIdRef.current = requestId

    // 构建消息历史（包含本次用户消息）
    const allMessages = [
      ...(instance.systemPrompt
        ? [{ role: 'system' as const, content: instance.systemPrompt }]
        : []),
      ...[...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
    ]

    const res = await window.electronAPI.llm.streamChat(requestId, instance.modelId, allMessages)
    if (!res.ok) {
      // 主进程启动失败（不是流错误）
      setIsStreaming(false)
      setStreamingMessageId(null)
      currentRequestIdRef.current = null
      setMessages((prev) => prev.slice(0, -1)) // 移除 assistant 占位
      showToast(res.error ?? '发送失败，请检查模型配置')
    }
  }, [selectedId, inputText, isStreaming, instances, messages, showToast])

  // ── 键盘事件 ─────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ── 退出登录 ─────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await window.electronAPI.auth.clear()
    navigate('/onboarding')
  }

  // ── 新建实例 ─────────────────────────────────────────────────────────────

  const handleInstanceCreated = (instance: Instance) => {
    setInstances((prev) => [...prev, instance])
    setSelectedId(instance.id)
    setShowCreateModal(false)
  }

  const selected = instances.find((i) => i.id === selectedId) ?? null

  return (
    <div className="flex h-screen bg-white overflow-hidden select-none">
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm text-white transition-all ${
              t.type === 'error'
                ? 'bg-red-500'
                : t.type === 'success'
                ? 'bg-green-500'
                : 'bg-gray-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* ── 新建实例弹窗 ─────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateInstanceModal
          models={models}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleInstanceCreated}
        />
      )}

      {/* ── 左侧：实例列表 ───────────────────────────────────────────────── */}
      <aside className="flex flex-col w-[260px] min-w-[220px] border-r border-gray-100 bg-[#f7f7f7]">
        {/* 顶部：用户信息 */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userInfo?.email?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">
              {userInfo?.email ?? '加载中...'}
            </p>
            <p className="text-[11px] text-gray-400 capitalize">{userInfo?.plan ?? ''}</p>
          </div>
          {/* 设置入口 */}
          <button
            onClick={() => navigate('/settings')}
            title="设置"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* 实例列表 */}
        <div className="flex-1 overflow-y-auto">
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">暂无实例</p>
              <p className="text-xs text-gray-300 mt-1">点击下方按钮新建</p>
            </div>
          ) : (
            instances.map((instance) => {
              const model = models.find((m) => m.id === instance.modelId)
              return (
                <button
                  key={instance.id}
                  onClick={() => setSelectedId(instance.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors ${
                    selectedId === instance.id ? 'bg-white border-r-2 border-indigo-500' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {instance.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-800 truncate">{instance.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {model?.modelName ?? '未知模型'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* 底部：新建按钮 */}
        <div className="px-3 py-3 border-t border-gray-100 space-y-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建实例
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* ── 右侧：聊天区 ─────────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0">
        {selected ? (
          <>
            {/* 聊天顶栏 */}
            <header className="flex items-center px-5 py-3 border-b border-gray-100 bg-white">
              <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{selected.name}</p>
                <p className="text-[11px] text-gray-400">
                  {models.find((m) => m.id === selected.modelId)?.modelName ?? ''}
                </p>
              </div>
            </header>

            {/* 消息区 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#f9f9f9]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                  <p className="text-sm text-gray-400">开始和 {selected.name} 对话吧</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isStreaming && msg.id === streamingMessageId}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isStreaming ? '回复中...' : '输入消息（Enter 发送，Shift+Enter 换行）'}
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all max-h-32 disabled:bg-gray-50 disabled:text-gray-400"
                  style={{
                    height: 'auto',
                    minHeight: '42px',
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !inputText.trim()}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white rounded-xl transition-colors"
                >
                  {isStreaming ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* 未选中时的欢迎页 */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
              <span className="text-indigo-600 text-3xl font-bold">M</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">欢迎使用 MemCore</h2>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              从左侧选择一个 AI 实例开始对话，或点击「新建实例」创建第一个 AI 助手
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
