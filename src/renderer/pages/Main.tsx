/**
 * Main.tsx — 主界面
 * 微信电脑版风格：左侧实例列表 + 右侧聊天区
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InstanceConfig, ModelConfig, ChatMessage } from '../types'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

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

  const handleSend = async () => {
    if (!input.trim() || sending || !selectedId || !selectedInstance || !selectedModel) return

    // P1-2 fix: 先清理可能残留的旧流（防止快速重发竞态）
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    const userContent = input.trim()
    setInput('')
    setSending(true)

    const requestId = globalThis.crypto.randomUUID()
    currentRequestIdRef.current = requestId
    const userMsg: ChatMessage = { role: 'user', content: userContent, ts: Date.now() }
    const assistantPlaceholder: ChatMessage & { streaming: boolean } = {
      role: 'assistant', content: '', ts: Date.now(), streaming: true
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])

    // 订阅流事件
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
        // done
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
        if (error !== 'ABORTED') {
          setToast('发送失败：' + error)
        }
        setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.content === '' && (m as any).streaming)))
        setSending(false)
        cleanupRef.current = null  // P1-3 fix: onError 路径也清零
      }
    )
    cleanupRef.current = cleanup

    // 构造历史消息（排除刚加的占位符，取最近 20 条）
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
    })

    if (!res.ok) {
      cleanup()
      cleanupRef.current = null
      setToast(res.error ?? '发送失败')
      setMessages((prev) => prev.slice(0, -2))
      setSending(false)
    }
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
    setSending(false)
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
              <div>
                <p className="font-medium text-gray-800 text-sm">{selectedInstance.name}</p>
                <p className="text-xs text-gray-400">{selectedModel?.name ?? ''}</p>
              </div>
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

            {/* 输入区 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all max-h-32 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
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
