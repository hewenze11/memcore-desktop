/**
 * Settings.tsx — 设置页
 *
 * 功能：
 *  - 算力模型管理：模型列表（名称/BaseURL/模型名）+ 添加/删除
 *  - 添加模型表单：名称 + BaseURL + API Key + 模型名 + [测试连接] 按钮
 *  - 测试连接：调 models.add，成功提示，失败显示错误
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Model } from '../types'

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState {
  id: number
  message: string
  type: 'error' | 'success'
}

function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const counterRef = React.useRef(0)

  const show = React.useCallback((message: string, type: ToastState['type'] = 'error') => {
    const id = ++counterRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return { toasts, show }
}

// ── 添加模型表单 ──────────────────────────────────────────────────────────────

interface AddModelFormProps {
  onAdded: (model: Model) => void
  onCancel: () => void
}

function AddModelForm({ onAdded, onCancel }: AddModelFormProps) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const validate = () => {
    if (!name.trim()) return '请输入模型名称'
    if (!baseUrl.trim()) return '请输入 API BaseURL'
    if (!apiKey.trim()) return '请输入 API Key'
    if (!modelName.trim()) return '请输入模型名'
    return null
  }

  const handleAdd = async () => {
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await window.electronAPI.models.add({
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/$/, ''), // 移除尾部斜杠
        apiKey: apiKey.trim(),
        modelName: modelName.trim(),
      })

      if (res.ok && res.data) {
        setSuccess('模型添加成功！')
        // 短暂展示成功后关闭
        setTimeout(() => {
          onAdded({
            id: (res.data as { id: string }).id,
            name: name.trim(),
            baseUrl: baseUrl.trim().replace(/\/$/, ''),
            modelName: modelName.trim(),
          })
        }, 800)
      } else {
        setError(res.error ?? '添加失败，请检查配置')
      }
    } catch {
      setError('操作出错，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">添加算力模型</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* 模型名称 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">显示名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：DeepSeek-R1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
          />
        </div>

        {/* 模型名 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">模型标识符</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="例如：deepseek-r1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
          />
        </div>
      </div>

      {/* BaseURL */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">API Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="例如：https://api.deepseek.com/v1"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
        />
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
        />
        <p className="text-[11px] text-gray-400 mt-1">Key 将加密存储在系统 Keychain 中，不可在 DevTools 查看</p>
      </div>

      {/* 状态提示 */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>
      )}

      {/* 按钮 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl transition-colors"
        >
          {loading ? '验证中...' : '测试连接并添加'}
        </button>
      </div>
    </div>
  )
}

// ── Settings 组件 ─────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate()
  const { toasts, show: showToast } = useToast()

  const [models, setModels] = useState<Model[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 加载模型列表
  useEffect(() => {
    window.electronAPI.models.list().then((res) => {
      if (res.ok && res.data) setModels(res.data as Model[])
    })
  }, [])

  const handleModelAdded = (model: Model) => {
    setModels((prev) => [...prev, model])
    setShowAddForm(false)
    showToast('模型添加成功！', 'success')
  }

  const handleDeleteModel = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await window.electronAPI.models.delete(id)
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== id))
      } else {
        showToast(res.error ?? '删除失败')
      }
    } catch {
      showToast('删除出错，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex h-screen bg-[#f9f9f9] overflow-hidden select-none">
      {/* Toast */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm text-white ${
              t.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-6">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/main')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <h1 className="text-lg font-semibold text-gray-800">设置</h1>
        </div>

        {/* 算力模型管理 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">算力模型</h2>
              <p className="text-xs text-gray-400 mt-0.5">管理用于对话的 LLM API 配置</p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加模型
              </button>
            )}
          </div>

          {/* 添加表单 */}
          {showAddForm && (
            <AddModelForm
              onAdded={handleModelAdded}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* 模型列表 */}
          {models.length === 0 && !showAddForm ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white border border-gray-200 rounded-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">还没有添加任何算力模型</p>
              <p className="text-xs text-gray-300 mt-1">点击右上角「添加模型」开始</p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4.5 h-4.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width: '18px', height: '18px'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{model.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400 truncate">{model.baseUrl}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] font-mono text-indigo-400 flex-shrink-0">{model.modelName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteModel(model.id)}
                    disabled={deletingId === model.id}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="删除模型"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
