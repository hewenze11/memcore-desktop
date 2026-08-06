/**
 * Settings.tsx — 设置页
 * 算力模型管理：添加/删除模型，Key 由主进程安全存储
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModelConfig } from '../types'

interface AddModelForm {
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
}

const EMPTY_FORM: AddModelForm = { name: '', baseUrl: '', apiKey: '', modelName: '' }

export default function Settings() {
  const navigate = useNavigate()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [form, setForm] = useState<AddModelForm>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState<{ email: string; plan: string } | null>(null)

  const loadModels = useCallback(async () => {
    const res = await window.electronAPI.models.list()
    if (res.ok) setModels(res.models)
  }, [])

  useEffect(() => {
    loadModels()
    window.electronAPI.auth.getUserInfo().then((res) => {
      if (res.ok && res.userInfo) setUserInfo(res.userInfo)
    })
  }, [loadModels])

  const handleAdd = async () => {
    setError('')
    setSuccess('')
    if (!form.name || !form.baseUrl || !form.apiKey || !form.modelName) {
      setError('所有字段均为必填')
      return
    }
    setAdding(true)
    try {
      const res = await window.electronAPI.models.add(form)
      if (res.ok) {
        setSuccess('模型添加成功')
        setForm(EMPTY_FORM)
        setShowForm(false)
        loadModels()
      } else {
        setError(res.error ?? '添加失败')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.models.delete(id)
    loadModels()
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶栏 */}
      <header className="flex items-center px-5 py-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/main')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mr-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h1 className="font-semibold text-gray-800">设置</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl mx-auto w-full">
        {/* 账户信息 */}
        {userInfo && (
          <section className="mb-8 p-4 bg-gray-50 rounded-xl">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">账户</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                {userInfo.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{userInfo.email}</p>
                <p className="text-xs text-gray-400 capitalize">{userInfo.plan} 套餐</p>
              </div>
            </div>
          </section>
        )}

        {/* 算力模型 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">算力模型</h2>
            <button
              onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showForm ? '取消' : '+ 添加模型'}
            </button>
          </div>

          {/* 添加表单 */}
          {showForm && (
            <div className="mb-4 p-4 border border-gray-200 rounded-xl space-y-3">
              {[
                { key: 'name', label: '名称', placeholder: '我的 GPT-4o', type: 'text' },
                { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.openai.com/v1', type: 'text' },
                { key: 'modelName', label: '模型名', placeholder: 'gpt-4o', type: 'text' },
                { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof AddModelForm]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              ))}

              {error && <p className="text-xs text-red-500">{error}</p>}
              {success && <p className="text-xs text-green-600">{success}</p>}

              <button
                onClick={handleAdd}
                disabled={adding}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm rounded-lg transition-colors"
              >
                {adding ? '验证中...' : '测试连接并添加'}
              </button>
              <p className="text-xs text-gray-400 text-center">添加前会验证连接，确保 API Key 可用</p>
            </div>
          )}

          {/* 模型列表 */}
          {models.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">还没有算力模型</p>
              <p className="text-xs mt-1">添加一个模型后才能创建 AI 实例</p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{model.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{model.modelName} · {model.baseUrl}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-4 flex-shrink-0"
                  >
                    删除
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
