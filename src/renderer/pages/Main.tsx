/**
 * Main.tsx — 主界面（重构版）
 * 黑白极简风，左侧导航 + 右侧内容
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InstanceConfig, ModelConfig, ChatMessage } from '../types'
import MarkdownRenderer from '../components/MarkdownRenderer'

// ── AdvancedPanel ─────────────────────────────────────────────────────────────
function AdvancedPanel({ memoryContext, onConfirm, onCancel, onRegenerate }: {
  memoryContext: string
  onConfirm: (ctx: string) => void
  onCancel: () => void
  onRegenerate: (instr: string) => void
}) {
  const [editedCtx, setEditedCtx] = useState(memoryContext)
  const [extraInstr, setExtraInstr] = useState('')
  return (
    <div className="border-t border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 space-y-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#909090]">⚡ 记忆上下文</span>
        <button onClick={onCancel} className="text-xs text-[#505050] hover:text-white transition-colors">取消</button>
      </div>
      <textarea value={editedCtx} onChange={e => setEditedCtx(e.target.value)} rows={4}
        placeholder="（无记忆上下文，将直连算力模型）"
        className="w-full text-xs border border-[#2a2a2a] bg-[#111] rounded-lg px-2.5 py-2 outline-none focus:border-[#505050] resize-none text-[#d0d0d0] leading-relaxed" />
      <div className="flex gap-2">
        <input type="text" value={extraInstr} onChange={e => setExtraInstr(e.target.value)}
          placeholder="补充召回指令..."
          className="flex-1 text-xs border border-[#2a2a2a] bg-[#111] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#505050] text-[#d0d0d0]" />
        <button onClick={() => { if (extraInstr.trim()) onRegenerate(extraInstr.trim()) }}
          disabled={!extraInstr.trim()}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#909090] hover:text-white hover:border-[#505050] disabled:opacity-40 flex-shrink-0 transition-colors">
          重新生成
        </button>
      </div>
      <button onClick={() => onConfirm(editedCtx)}
        className="w-full py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-[#e8e8e8] transition-colors">
        用此上下文发送
      </button>
    </div>
  )
}

// ── NewInstanceModal：内嵌模型配置 ────────────────────────────────────────────
function NewInstanceModal({ models, onClose, onCreated, onModelAdded }: {
  models: ModelConfig[]
  onClose: () => void
  onCreated: (instance: InstanceConfig) => void
  onModelAdded: (model: ModelConfig) => void
}) {
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelMode, setModelMode] = useState<'existing' | 'new'>(models.length > 0 ? 'existing' : 'new')
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id ?? '')
  // 新模型表单
  const [newModelName, setNewModelName] = useState('')
  const [newModelBaseUrl, setNewModelBaseUrl] = useState('')
  const [newModelApiKey, setNewModelApiKey] = useState('')
  const [newModelName2, setNewModelName2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('请输入实例名称'); return }
    setLoading(true); setError('')
    try {
      let modelId = selectedModelId
      // 如果选择新建模型，先添加
      if (modelMode === 'new') {
        if (!newModelName || !newModelBaseUrl || !newModelApiKey || !newModelName2) {
          setError('请填写完整的模型配置'); setLoading(false); return
        }
        const mRes = await window.electronAPI.models.add({
          name: newModelName, baseUrl: newModelBaseUrl, apiKey: newModelApiKey, modelName: newModelName2
        })
        if (!mRes.ok) { setError(mRes.error ?? '模型添加失败'); setLoading(false); return }
        onModelAdded(mRes.model)
        modelId = mRes.model.id
      }
      const res = await window.electronAPI.instances.create({ name: name.trim(), modelId, systemPrompt: systemPrompt.trim() || undefined })
      if (res.ok && res.instance) onCreated(res.instance)
      else setError(res.error ?? '创建失败')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white text-sm">新建实例</h2>
          <button onClick={onClose} className="text-[#505050] hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1.5">实例名称 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="如：工作助手"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-[#2a2a2a] bg-[#080808] rounded-xl outline-none focus:border-[#505050] text-white placeholder-[#404040]" />
          </div>

          {/* 算力模型 */}
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1.5">算力模型 *</label>
            {models.length > 0 && (
              <div className="flex gap-2 mb-2">
                <button onClick={() => setModelMode('existing')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${modelMode === 'existing' ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#707070] hover:text-white hover:border-[#505050]'}`}>
                  选择已有
                </button>
                <button onClick={() => setModelMode('new')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${modelMode === 'new' ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#707070] hover:text-white hover:border-[#505050]'}`}>
                  + 新建模型
                </button>
              </div>
            )}
            {modelMode === 'existing' && models.length > 0 ? (
              <select value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#2a2a2a] bg-[#080808] rounded-xl outline-none focus:border-[#505050] text-white">
                {models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.modelName}</option>)}
              </select>
            ) : (
              <div className="space-y-2 p-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl">
                <p className="text-[10px] text-[#505050] mb-2">填写模型信息，点创建后自动测试连接</p>
                {[
                  { key: 'name', label: '名称', val: newModelName, set: setNewModelName, ph: '如：DeepSeek V3', type: 'text' },
                  { key: 'baseUrl', label: 'Base URL', val: newModelBaseUrl, set: setNewModelBaseUrl, ph: 'https://openrouter.ai/api/v1', type: 'text' },
                  { key: 'modelName', label: '模型名', val: newModelName2, set: setNewModelName2, ph: 'deepseek/deepseek-chat-v3-0324', type: 'text' },
                  { key: 'apiKey', label: 'API Key', val: newModelApiKey, set: setNewModelApiKey, ph: 'sk-...', type: 'password' },
                ].map(({ key, label, val, set, ph, type }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-[#505050] mb-0.5">{label}</label>
                    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#2a2a2a] bg-[#111] rounded-lg outline-none focus:border-[#505050] text-white placeholder-[#333]" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1.5">常驻提示词（可选）</label>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              placeholder="如：你是一位严谨的技术顾问..." rows={2}
              className="w-full px-3 py-2 text-sm border border-[#2a2a2a] bg-[#080808] rounded-xl outline-none focus:border-[#505050] text-white placeholder-[#404040] resize-none" />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 text-sm text-[#707070] border border-[#2a2a2a] rounded-xl hover:text-white hover:border-[#505050] transition-colors">
              取消
            </button>
            <button onClick={handleCreate} disabled={loading}
              className="flex-1 py-2 text-sm text-black bg-white hover:bg-[#e8e8e8] disabled:opacity-40 rounded-xl font-medium transition-colors">
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
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#d0d0d0] text-xs px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
      <span>⚠️</span><span>{message}</span>
    </div>
  )
}

function isKeyInvalidError(error: string): boolean {
  return error === 'AUTH_FAIL' || error === 'NO_KEY'
}

function parseStreamError(error?: string): string {
  if (!error) return '发送失败'
  if (error === 'NO_KEY') return '未设置 API Key，请先配置'
  if (error === 'AUTH_FAIL') return 'API Key 已失效，请重新验证'
  if (error === 'SERVER_ERROR') return '服务器错误，请稍后重试'
  if (error.startsWith('REQUEST_FAIL_')) return `请求失败（${error.replace('REQUEST_FAIL_', '')}）`
  if (/fetch|network|ECONNREFUSED|ENOTFOUND|timeout|ETIMEDOUT/i.test(error)) return '网络连接失败，请检查网络'
  if (error === 'ABORTED') return ''
  return '发送失败'
}

// ── 消息气泡 ──────────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === 'user'
  const [showTime, setShowTime] = useState(false)
  const timeStr = msg.ts ? new Date(msg.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 group`}
      onMouseEnter={() => setShowTime(true)} onMouseLeave={() => setShowTime(false)}>
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {(msg.content || msg.streaming) && (
          <div className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
            isUser
              ? 'bg-white text-black rounded-br-sm whitespace-pre-wrap leading-relaxed'
              : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#d0d0d0] rounded-bl-sm'
          }`}>
            {isUser
              ? (msg.content || (msg.streaming ? <span className="opacity-40">▍</span> : null))
              : (msg.content ? <MarkdownRenderer content={msg.content} /> : <span className="opacity-40">▍</span>)
            }
          </div>
        )}
        {timeStr && (
          <span className={`text-[10px] text-[#404040] mt-0.5 mx-1 transition-opacity duration-150 ${showTime ? 'opacity-100' : 'opacity-0'}`}>
            {timeStr}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 记忆状态栏 ────────────────────────────────────────────────────────────────
type MemoryStatus = 'idle' | 'recalling' | 'degraded' | 'archived' | 'queued'
function MemBar({ status }: { status: MemoryStatus }) {
  if (status === 'idle') return null
  const cfg: Record<string, { icon: React.ReactNode; text: string; cls: string }> = {
    recalling: { icon: <svg className="w-3 h-3 animate-spin text-[#505050]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>, text: '正在召唤记忆...', cls: 'text-[#505050]' },
    degraded: { icon: <span className="text-amber-400">⚠</span>, text: '记忆服务不可用，直连模型', cls: 'text-amber-500' },
    archived: { icon: <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />, text: '记忆已同步', cls: 'text-[#505050]' },
    queued: { icon: <span className="w-1.5 h-1.5 rounded-full bg-[#404040] inline-block" />, text: '记忆同步延迟，稍后自动补传', cls: 'text-[#505050]' },
  }
  const c = cfg[status]; if (!c) return null
  return (
    <div className={`flex items-center gap-1.5 px-4 py-1 text-xs ${c.cls}`}>{c.icon}<span>{c.text}</span></div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function Main() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<InstanceConfig[]>([])
  const [models, setModels] = useState<ModelConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 左侧面板：chat / memory
  const [leftPanel, setLeftPanel] = useState<'chat' | 'memory'>('chat')
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [toast, setToast] = useState('')
  const [memStatus, setMemStatus] = useState<MemoryStatus>('idle')
  const [advancedMode, setAdvancedMode] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [memoryContext, setMemoryContext] = useState('')
  const [supplementInstr, setSupplementInstr] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const pendingUserContentRef = useRef<string | null>(null)
  const recallVersionRef = useRef(0)
  const recallWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)

  useEffect(() => {
    const cleanup = window.electronAPI.memory.onStatus((data) => {
      if (data.instanceId && data.instanceId !== selectedId) return
      if ((data.status === 'recallDone' || (data.status === 'degraded' && data.advancedMode))
          && data.recallVersion !== undefined && data.recallVersion !== recallVersionRef.current) return
      if (data.status === 'recalling') setMemStatus('recalling')
      else if (data.status === 'recallDone') {
        if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
        setMemStatus('idle')
        if (data.context !== undefined) { setMemoryContext(data.context); setAwaitingConfirm(true); setSending(false) }
      } else if (data.status === 'degraded') {
        if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
        setMemStatus('degraded'); setTimeout(() => setMemStatus('idle'), 5000)
        if (data.advancedMode) { setMemoryContext(''); setAwaitingConfirm(true); setSending(false) }
      } else if (data.status === 'archived') {
        setMemStatus('archived'); setTimeout(() => setMemStatus('idle'), 3000)
      } else if (data.status === 'queued') {
        setMemStatus('queued'); setTimeout(() => setMemStatus('idle'), 8000)
      }
    })
    return cleanup
  }, [selectedId])

  const reload = useCallback(async () => {
    const [instRes, modelRes] = await Promise.all([window.electronAPI.instances.list(), window.electronAPI.models.list()])
    if (instRes.ok) setInstances(instRes.instances)
    if (modelRes.ok) setModels(modelRes.models)
  }, [])

  useEffect(() => {
    reload()
    window.electronAPI.auth.getUserInfo().then(r => { if (r.ok && r.userInfo) setUserEmail(r.userInfo.email) })
  }, [reload])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    window.electronAPI.conversations.get(selectedId).then(r => { if (r.ok) setMessages(r.messages) })
  }, [selectedId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const selectedInstance = instances.find(i => i.id === selectedId) ?? null
  const selectedModel = models.find(m => m.id === selectedInstance?.modelId) ?? null

  const doStreamChat = async (userContent: string, overrideContext?: string) => {
    if (!selectedId || !selectedInstance || !selectedModel) return
    const requestId = globalThis.crypto.randomUUID()
    currentRequestIdRef.current = requestId
    const userMsg: ChatMessage = { role: 'user', content: userContent, ts: Date.now(), msgId: globalThis.crypto.randomUUID() }
    const assistantPlaceholder: ChatMessage & { streaming: boolean } = { role: 'assistant', content: '', ts: Date.now(), streaming: true, msgId: globalThis.crypto.randomUUID() }
    setMessages(prev => [...prev, userMsg, assistantPlaceholder])
    let accumulated = ''
    const cleanup = window.electronAPI.llm.subscribe(requestId,
      (delta) => { accumulated += delta; setMessages(prev => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: accumulated, streaming: true }; return next }) },
      () => { setMessages(prev => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false }; return next }); setSending(false); cleanupRef.current = null; currentRequestIdRef.current = null },
      (error) => {
        if (error !== 'ABORTED') { const msg = parseStreamError(error); setToast(msg); if (isKeyInvalidError(error)) setTimeout(() => navigate('/onboarding'), 2000) }
        setMessages(prev => prev.filter(m => !(m.role === 'assistant' && m.content === '' && (m as any).streaming))); setSending(false); cleanupRef.current = null; currentRequestIdRef.current = null
      }
    )
    cleanupRef.current = cleanup
    const history = messages.filter(m => !((m as any).streaming && m.content === '')).slice(-20).map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: userContent })
    const res = await window.electronAPI.llm.streamChat({ requestId, instanceId: selectedId, modelId: selectedInstance.modelId, messages: history, systemPrompt: selectedInstance.systemPrompt, overrideContext, skipRecall: overrideContext !== undefined })
    if (!res.ok) {
      cleanup(); cleanupRef.current = null; currentRequestIdRef.current = null
      const errMsg = parseStreamError(res.error); setToast(errMsg)
      if (res.error && isKeyInvalidError(res.error)) setTimeout(() => navigate('/onboarding'), 2000)
      setMessages(prev => prev.slice(0, -2)); setSending(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || sending || awaitingConfirm || !selectedId || !selectedInstance || !selectedModel) return
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    if (currentRequestIdRef.current) { window.electronAPI.llm.abort(currentRequestIdRef.current); currentRequestIdRef.current = null }
    const userContent = input.trim(); setInput(''); setMemStatus('idle')
    if (advancedMode) {
      pendingUserContentRef.current = userContent; recallVersionRef.current += 1; setSending(true)
      const currentVersion = recallVersionRef.current
      const res = await window.electronAPI.memory.recallOnly({ instanceId: selectedId, userMessage: userContent, supplementInstr: supplementInstr || undefined, recallVersion: currentVersion })
      if (!res.ok) { setMemoryContext(''); setAwaitingConfirm(true); setSending(false); return }
      if (recallWatchdogRef.current) clearTimeout(recallWatchdogRef.current)
      recallWatchdogRef.current = setTimeout(() => { if (recallVersionRef.current === currentVersion) { setMemoryContext(''); setAwaitingConfirm(true); setSending(false); setToast('记忆召回超时，请在面板中直接确认发送') } }, 30000)
    } else { setSending(true); await doStreamChat(userContent) }
  }

  const handleConfirmAndGenerate = async (editedCtx: string) => {
    const userContent = pendingUserContentRef.current; if (!userContent) return
    setAwaitingConfirm(false); pendingUserContentRef.current = null; setSupplementInstr(''); setSending(true)
    try { await doStreamChat(userContent, editedCtx) } catch { setSending(false) }
  }

  const handleCancelAdvanced = () => {
    recallVersionRef.current += 1
    if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
    setAwaitingConfirm(false); setMemoryContext(''); pendingUserContentRef.current = null; setSending(false)
  }

  const handleRegenerate = async (extraInstr: string) => {
    const userContent = pendingUserContentRef.current; if (!userContent || !selectedId) return
    setAwaitingConfirm(false); setMemoryContext(''); recallVersionRef.current += 1; setSending(true)
    const merged = supplementInstr ? `${supplementInstr}\n${extraInstr}` : extraInstr; setSupplementInstr(merged)
    const currentVersion = recallVersionRef.current
    const res = await window.electronAPI.memory.recallOnly({ instanceId: selectedId, userMessage: userContent, supplementInstr: merged || undefined, recallVersion: currentVersion })
    if (!res.ok) { setMemoryContext(''); setAwaitingConfirm(true); setSending(false); return }
    if (recallWatchdogRef.current) clearTimeout(recallWatchdogRef.current)
    recallWatchdogRef.current = setTimeout(() => { if (recallVersionRef.current === currentVersion) { setMemoryContext(''); setAwaitingConfirm(true); setSending(false); setToast('记忆召回超时') } }, 30000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSelectInstance = (id: string) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    if (currentRequestIdRef.current) { window.electronAPI.llm.abort(currentRequestIdRef.current); currentRequestIdRef.current = null }
    recallVersionRef.current += 1
    if (recallWatchdogRef.current) { clearTimeout(recallWatchdogRef.current); recallWatchdogRef.current = null }
    setSending(false); setMemStatus('idle'); setAwaitingConfirm(false); setMemoryContext(''); pendingUserContentRef.current = null
    setSelectedId(id); setLeftPanel('chat')
  }

  const handleDeleteInstance = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); await window.electronAPI.instances.delete(id)
    if (selectedId === id) setSelectedId(null); reload()
  }

  const handleLogout = async () => {
    await window.electronAPI.auth.clear(); navigate('/onboarding')
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts); const now = new Date()
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }

  return (
    <div className="flex h-screen bg-[#080808] overflow-hidden select-none">
      {/* ── 左侧 ──────────────────────────────────────────────────────────── */}
      <aside className="flex flex-col w-[260px] min-w-[200px] border-r border-[#1a1a1a] bg-[#0c0c0c]">
        {/* 顶栏：账号 + 设置 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[#1a1a1a]">
          <div className="flex-1 relative">
            <button onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
                {userEmail ? userEmail[0].toUpperCase() : 'M'}
              </div>
              <span className="text-xs text-[#909090] truncate flex-1 text-left">{userEmail || 'Memory Spider'}</span>
              <svg className="w-3 h-3 text-[#404040] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showUserMenu && (
              <div className="absolute top-full left-0 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-xl shadow-xl z-50 overflow-hidden">
                <button onClick={() => { setShowUserMenu(false); navigate('/settings') }}
                  className="w-full text-left px-3 py-2 text-xs text-[#909090] hover:bg-[#1a1a1a] hover:text-white transition-colors">
                  ⚙ 设置
                </button>
                <button onClick={() => { setShowUserMenu(false); handleLogout() }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#1a1a1a] transition-colors border-t border-[#1a1a1a]">
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 实例列表 */}
        <div className="flex-1 overflow-y-auto">
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <p className="text-xs text-[#404040]">暂无实例</p>
              <p className="text-[11px] text-[#303030] mt-1">点击下方按钮新建</p>
            </div>
          ) : (
            instances.map(inst => (
              <button key={inst.id} onClick={() => handleSelectInstance(inst.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors group ${selectedId === inst.id ? 'bg-[#1a1a1a]' : 'hover:bg-[#141414]'}`}>
                <div className="w-9 h-9 rounded-xl bg-[#2a2a2a] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  {inst.name[0]}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#d0d0d0] truncate">{inst.name}</span>
                    <span className="text-[10px] text-[#404040] flex-shrink-0 ml-2">{formatTime(inst.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-[#505050] truncate mt-0.5">
                    {models.find(m => m.id === inst.modelId)?.name ?? '未知模型'}
                  </p>
                </div>
                <button onClick={e => handleDeleteInstance(inst.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#404040] hover:text-red-400 flex-shrink-0 transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>

        {/* 新建按钮 */}
        <div className="px-3 py-3 border-t border-[#1a1a1a]">
          <button onClick={() => setShowNewModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white hover:bg-[#e8e8e8] text-black text-xs rounded-xl transition-colors font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建实例
          </button>
        </div>
      </aside>

      {/* ── 右侧 ──────────────────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0 bg-[#080808]">
        {selectedInstance ? (
          <>
            {/* 顶栏：实例名 + tab切换 + 高级模式 */}
            <header className="flex items-center px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0c0c0c] flex-shrink-0 gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {selectedInstance.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-xs truncate">{selectedInstance.name}</p>
                <p className="text-[10px] text-[#404040]">{selectedModel?.name ?? ''}</p>
              </div>
              {/* Tab切换：对话 / 记忆空间 */}
              <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-0.5">
                <button onClick={() => setLeftPanel('chat')}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${leftPanel === 'chat' ? 'bg-white text-black font-medium' : 'text-[#606060] hover:text-white'}`}>
                  对话
                </button>
                <button onClick={() => { setLeftPanel('memory'); navigate(`/memory/${selectedInstance.id}`) }}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${leftPanel === 'memory' ? 'bg-white text-black font-medium' : 'text-[#606060] hover:text-white'}`}>
                  记忆空间
                </button>
              </div>
              {/* 高级模式 */}
              <button onClick={() => { setAdvancedMode(v => !v); if (awaitingConfirm) handleCancelAdvanced() }}
                title={advancedMode ? '关闭高级模式' : '开启高级模式（发送前可审查/编辑记忆上下文）'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${advancedMode ? 'bg-amber-900/40 text-amber-400 border border-amber-800/40' : 'text-[#505050] border border-[#2a2a2a] hover:text-amber-400 hover:border-amber-800/40'}`}>
                <span>⚡</span>
                <span>高级模式</span>
              </button>
            </header>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="text-center text-xs text-[#303030] py-8">开始对话吧</div>
              )}
              {messages.map(msg => <MessageBubble key={(msg as any).msgId ?? `${msg.role}-${msg.ts}`} msg={msg} />)}
              <div ref={messagesEndRef} />
            </div>

            <MemBar status={memStatus} />

            {awaitingConfirm && (
              <AdvancedPanel memoryContext={memoryContext} onConfirm={handleConfirmAndGenerate}
                onCancel={handleCancelAdvanced} onRegenerate={handleRegenerate} />
            )}

            {/* 输入区 */}
            <div className="px-4 py-3 border-t border-[#1a1a1a] flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={awaitingConfirm ? '请先审查记忆上下文...' : '输入消息... (Enter 发送，Shift+Enter 换行)'}
                  rows={1} disabled={sending || awaitingConfirm}
                  className="flex-1 resize-none px-3 py-2.5 text-sm border border-[#2a2a2a] bg-[#111] rounded-xl outline-none focus:border-[#505050] text-white placeholder-[#404040] transition-all max-h-32 disabled:opacity-50" />
                <button onClick={handleSend} disabled={sending || !input.trim() || awaitingConfirm}
                  className="flex-shrink-0 px-4 py-2.5 bg-white hover:bg-[#e8e8e8] disabled:opacity-30 text-black text-xs rounded-xl transition-colors font-medium">
                  {sending ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> : '发送'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <line x1="12" y1="1" x2="12" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="12" y1="15" x2="12" y2="23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="1" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="15" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="3.5" y1="3.5" x2="9.2" y2="9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="14.8" y1="14.8" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="20.5" y1="3.5" x2="14.8" y2="9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9.2" y1="14.8" x2="3.5" y2="20.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[#909090] mb-1">Memory Spider</h2>
            <p className="text-xs text-[#404040]">从左侧选择或新建一个 AI 实例</p>
          </div>
        )}
      </main>

      {showNewModal && (
        <NewInstanceModal models={models} onClose={() => setShowNewModal(false)}
          onModelAdded={m => setModels(prev => [...prev, m])}
          onCreated={inst => { setShowNewModal(false); reload(); setSelectedId(inst.id) }} />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* 点击外部关闭用户菜单 */}
      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}
    </div>
  )
}
