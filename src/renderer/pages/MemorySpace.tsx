/**
 * MemorySpace.tsx — 记忆空间管理页面（M4）
 *
 * 功能：
 *   - 核心文档（增/删/编辑）
 *   - 标签管理（增/删）
 *   - 归档浏览（按日期折叠）
 *   - 记忆搜索（关键词/语义）
 *   - workspace_id 展示 + 爬虫提示词配置
 */

import React, { useEffect, useState, useCallback } from 'react'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useNavigate, useParams } from 'react-router-dom'

// ── 类型 ────────────────────────────────────────────────────────────────────

interface CoreDoc {
  id: string
  title: string
  content: string
  trigger_desc: string
  content_bytes: number
  updated_at: string
}

interface Tag {
  id: string
  name: string
  created_at: string
}

interface Summary {
  id: string
  session_id: string
  content: string
  created_at: string
}

interface MemMessage {
  id: string
  role: string
  content: string
  session_id: string
  created_at: string
}

// ── 通用请求工具 ─────────────────────────────────────────────────────────────

async function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', path: string, body?: unknown) {
  return window.electronAPI.memspace.request({ method, path, body })
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
      {message}
    </div>
  )
}

// ── Tab 组件 ─────────────────────────────────────────────────────────────────

type Tab = 'docs' | 'tags' | 'archive' | 'search' | 'workspace'

// ── CoreDocs 面板 ────────────────────────────────────────────────────────────

function CoreDocsPanel({ setToast }: { setToast: (m: string) => void }) {
  const [docs, setDocs] = useState<CoreDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTrigger, setEditTrigger] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api('GET', '/memory/docs')
    if (r.ok) setDocs((r.data as any).docs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (doc: CoreDoc) => {
    setEditingId(doc.id)
    setEditTitle(doc.title)
    setEditContent(doc.content)
    setEditTrigger(doc.trigger_desc)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    const r = await api('PUT', `/memory/docs/${editingId}`, {
      title: editTitle,
      content: editContent,
      trigger_desc: editTrigger,
    })
    setSaving(false)
    if (r.ok) {
      setToast('已保存')
      setEditingId(null)
      load()
    } else {
      setToast(`保存失败：${(r.data as any)?.error ?? r.error}`)
    }
  }

  const deleteDoc = async (id: string) => {
    const ok = await window.electronAPI.dialog.confirm('确认删除这条核心文档？此操作不可恢复。')
    if (!ok) return
    const r = await api('DELETE', `/memory/docs/${id}`)
    if (r.ok) { setToast('已删除'); load() }
    else setToast(`删除失败：${(r.data as any)?.error ?? r.error}`)
  }

  const createDoc = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setSaving(true)
    const r = await api('POST', '/memory/docs', {
      title: newTitle.trim(),
      content: newContent,
      trigger_desc: newTrigger,
    })
    setSaving(false)
    if (r.ok) {
      setToast('已创建')
      setCreating(false)
      setNewTitle(''); setNewContent(''); setNewTrigger('')
      load()
    } else {
      setToast(`创建失败：${(r.data as any)?.error ?? r.error}`)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">加载中...</div>

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[#505050]">核心文档是每次 AI 对话都会优先召回的长期记忆（最多 20 条，每条 2000 字节）</p>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex-shrink-0 ml-4"
        >
          + 新建
        </button>
      </div>

      {/* 新建表单 */}
      {creating && (
        <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="文档标题（必填）"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="文档内容（必填，最多 2000 字节）"
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <input
            type="text"
            value={newTrigger}
            onChange={e => setNewTrigger(e.target.value)}
            placeholder="触发描述（选填，如：提到工作时召回）"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">取消</button>
            <button onClick={createDoc} disabled={saving} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
              {saving ? '保存中...' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* 文档列表 */}
      {docs.length === 0 && !creating && (
        <div className="text-center text-sm text-gray-300 py-8">暂无核心文档</div>
      )}
      {docs.map(doc => (
        <div key={doc.id} className="border border-gray-100 rounded-xl p-3">
          {editingId === doc.id ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <input
                type="text"
                value={editTrigger}
                onChange={e => setEditTrigger(e.target.value)}
                placeholder="触发描述（选填）"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 text-gray-500">取消</button>
                <button onClick={saveEdit} disabled={saving} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{doc.title}</p>
                  {doc.trigger_desc && <p className="text-xs text-indigo-500 mt-0.5">触发：{doc.trigger_desc}</p>}
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-3">{doc.content}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <span className="text-[11px] text-gray-300">{doc.content_bytes}B</span>
                  <button onClick={() => startEdit(doc)} className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1">编辑</button>
                  <button onClick={() => deleteDoc(doc.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">删除</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tags 面板 ────────────────────────────────────────────────────────────────

function TagsPanel({ setToast }: { setToast: (m: string) => void }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api('GET', '/memory/tags')
    if (r.ok) setTags((r.data as any).tags ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addTag = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const r = await api('POST', '/memory/tags', { name: newName.trim() })
    setAdding(false)
    if (r.ok) {
      setToast('标签已创建')
      setNewName('')
      load()
    } else {
      setToast(`创建失败：${(r.data as any)?.error ?? r.error}`)
    }
  }

  const deleteTag = async (id: string) => {
    const ok = await window.electronAPI.dialog.confirm('确认删除此标签？相关联的消息标签也会一并移除。')
    if (!ok) return
    const r = await api('DELETE', `/memory/tags/${id}`)
    if (r.ok) { setToast('已删除'); load() }
    else setToast(`删除失败：${(r.data as any)?.error ?? r.error}`)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">加载中...</div>

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-[#505050]">标签用于对记忆内容分类，归档时会自动关联匹配的标签</p>

      {/* 新建标签 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag() }}
          placeholder="输入标签名称，按 Enter 创建"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button onClick={addTag} disabled={adding || !newName.trim()} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-40">
          {adding ? '...' : '添加'}
        </button>
      </div>

      {/* 标签列表 */}
      {tags.length === 0 && <div className="text-center text-sm text-gray-300 py-6">暂无标签</div>}
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <div key={tag.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full group">
            <span className="text-sm text-gray-700">{tag.name}</span>
            <button
              onClick={() => deleteTag(tag.id)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Archive 面板 ─────────────────────────────────────────────────────────────

function ArchivePanel() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      const r = await api('GET', '/memory/recent?limit_summary=200')
      if (r.ok) setSummaries((r.data as any).summaries ?? [])
      setLoading(false)
    })()
  }, [])

  // 按日期分组
  const grouped = summaries.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {} as Record<string, Summary[]>)

  const toggleDate = (date: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">加载中...</div>

  if (summaries.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-300">暂无归档记录</div>
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs text-gray-400 mb-3">每次对话结束后自动归档，按日期折叠展示</p>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleDate(date)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">{date}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#505050]">{items.length} 条归档</span>
              <span className="text-gray-400">{expanded.has(date) ? '▴' : '▾'}</span>
            </div>
          </button>
          {expanded.has(date) && (
            <div className="divide-y divide-gray-50">
              {items.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-1">
                    {new Date(s.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    · session {s.session_id.slice(0, 8)}...
                  </p>
                  <div className="text-sm text-[#d0d0d0] leading-relaxed"><MarkdownRenderer content={s.content} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Search 面板 ──────────────────────────────────────────────────────────────

function SearchPanel() {
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword')
  const [results, setResults] = useState<MemMessage[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const doSearch = async () => {
    if (!keyword.trim()) return
    setSearching(true)
    setError('')
    setSearched(false)

    // 搜索走 POST body，不拼 query string，无需 encodeURIComponent
    const path = mode === 'keyword' ? '/memory/search' : '/memory/semantic'
    const body = mode === 'keyword'
      ? { keyword: keyword.trim(), limit: 30 }
      : { query: keyword.trim(), limit: 20 }

    const r = await api('POST', path, body)
    setSearching(false)
    setSearched(true)

    if (r.ok) {
      setResults((r.data as any).messages ?? [])
    } else {
      setError((r.data as any)?.error ?? r.error ?? '搜索失败')
      setResults([])
    }
  }

  return (
    <div className="p-4 space-y-3">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
          placeholder={mode === 'keyword' ? '关键词搜索...' : '语义搜索（自然语言描述）...'}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={doSearch}
          disabled={searching || !keyword.trim()}
          className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-40"
        >
          {searching ? '...' : '搜索'}
        </button>
      </div>

      {/* 搜索模式 */}
      <div className="flex gap-3">
        {(['keyword', 'semantic'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m === 'keyword' ? '关键词' : '语义搜索'}
          </button>
        ))}
      </div>

      {/* 错误 */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 结果 */}
      {searched && results.length === 0 && !error && (
        <div className="text-center text-sm text-gray-300 py-6">未找到相关记忆</div>
      )}
      <div className="space-y-2">
        {results.map(msg => (
          <div key={msg.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
              }`}>
                {msg.role === 'user' ? '我' : 'AI'}
              </span>
              <span className="text-[11px] text-gray-400">
                {new Date(msg.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-sm text-[#d0d0d0] leading-relaxed line-clamp-4"><MarkdownRenderer content={msg.content} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Workspace 面板 ────────────────────────────────────────────────────────────

function WorkspacePanel({ workspaceId, setToast }: { workspaceId: string | null; setToast: (m: string) => void }) {
  const [prompt, setPrompt] = useState('')
  const [promptLoaded, setPromptLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    if (!workspaceId) return
    ;(async () => {
      const r = await api('GET', `/workspaces/${workspaceId}`)
      if (r.ok) {
        const p = (r.data as any).user_system_prompt ?? ''
        setPrompt(p)
        setCharCount([...p].length)
        setPromptLoaded(true)
      }
    })()
  }, [workspaceId])

  const handlePromptChange = (v: string) => {
    setPrompt(v)
    setCharCount([...v].length)
  }

  const savePrompt = async () => {
    if (!workspaceId) return
    setSaving(true)
    const r = await api('PATCH', `/workspaces/${workspaceId}`, { user_system_prompt: prompt || null })
    setSaving(false)
    if (r.ok) setToast('已保存')
    else setToast(`保存失败：${(r.data as any)?.error ?? r.error}`)
  }

  const copyId = () => {
    if (workspaceId) {
      navigator.clipboard.writeText(workspaceId)
        .then(() => setToast('Workspace ID 已复制'))
        .catch(() => setToast('复制失败，请手动选取'))
    }
  }

  return (
    <div className="p-4 space-y-5">
      {/* Workspace ID */}
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">Workspace ID</label>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-gray-700 font-mono bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 truncate">
            {workspaceId ?? '加载中...'}
          </span>
          <button
            onClick={copyId}
            disabled={!workspaceId}
            className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            复制
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">此 ID 用于 API 接入，每个实例独立隔离记忆</p>
      </div>

      {/* 爬虫提示词 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-500">自定义记忆指令（爬虫提示词）</label>
          <span className={`text-[11px] ${charCount > 1800 ? 'text-red-500' : 'text-gray-400'}`}>{charCount}/2000</span>
        </div>
        <textarea
          value={prompt}
          onChange={e => handlePromptChange(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="例如：重点关注我的工作项目进展、技术决策和重要会议记录。不需要记录日常闲聊。"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
          disabled={!promptLoaded}
        />
        <p className="text-xs text-gray-400 mt-1">下次归档时，这段指令会追加到 AI 记忆整理的系统提示词中</p>
        <button
          onClick={savePrompt}
          disabled={saving || !promptLoaded}
          className="mt-2 text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-40 hover:bg-indigo-700"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

// ── 主页面 ───────────────────────────────────────────────────────────────────

export default function MemorySpace() {
  const navigate = useNavigate()
  const { instanceId } = useParams<{ instanceId: string }>()
  const [tab, setTab] = useState<Tab>('docs')
  const [toast, setToast] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [instanceName, setInstanceName] = useState('')

  const [instanceNotFound, setInstanceNotFound] = useState(false)

  useEffect(() => {
    if (!instanceId) { setInstanceNotFound(true); return }
    window.electronAPI.instances.list().then(r => {
      if (r.ok) {
        const inst = r.instances?.find((i: any) => i.id === instanceId)
        if (inst) {
          setWorkspaceId(inst.workspaceId)
          setInstanceName(inst.name)
        } else {
          setInstanceNotFound(true)
        }
      } else {
        setInstanceNotFound(true)
      }
    }).catch(() => setInstanceNotFound(true))
  }, [instanceId])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'docs', label: '核心文档' },
    { key: 'tags', label: '标签' },
    { key: 'archive', label: '归档记录' },
    { key: 'search', label: '搜索记忆' },
    { key: 'workspace', label: '空间设置' },
  ]

  if (instanceNotFound) {
    return (
      <div className="flex flex-col h-screen bg-[#080808] items-center justify-center">
        <p className="text-gray-400 text-sm mb-3">找不到该实例，请返回重试</p>
        <button onClick={() => navigate('/main')} className="text-sm text-indigo-600 hover:underline">返回主界面</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#080808] overflow-hidden select-none">
      {/* 顶栏 */}
      <header className="flex items-center px-5 py-3 border-b border-[#1a1a1a] bg-[#0c0c0c] flex-shrink-0">
        <button
          onClick={() => navigate('/main')}
          className="p-1.5 text-[#505050] hover:text-white mr-3 rounded-lg hover:bg-[#1a1a1a]"
        >
          ←
        </button>
        <div className="flex-1">
          <p className="font-medium text-white text-sm">记忆空间</p>
          {instanceName && <p className="text-xs text-[#505050]">{instanceName}</p>}
        </div>
      </header>

      {/* Tab 栏 */}
      <div className="flex border-b border-[#1a1a1a] px-4 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
              tab === t.key
                ? 'border-white text-white'
                : 'border-transparent text-[#404040] hover:text-[#909090]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto bg-[#080808]">
        {tab === 'docs' && <CoreDocsPanel setToast={setToast} />}
        {tab === 'tags' && <TagsPanel setToast={setToast} />}
        {tab === 'archive' && <ArchivePanel />}
        {tab === 'search' && <SearchPanel />}
        {tab === 'workspace' && <WorkspacePanel workspaceId={workspaceId} setToast={setToast} />}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
