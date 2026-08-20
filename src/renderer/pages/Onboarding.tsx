import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const navigate = useNavigate()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      setError('请输入 API Key')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.auth.verify(apiKey.trim())
      if (result.ok) {
        navigate('/main')
      } else {
        setError(result.error || '验证失败，请检查 API Key')
      }
    } catch (e: unknown) {
      setError('验证出错，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify()
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 select-none">
      <div className="w-full max-w-sm px-8 py-10 bg-white rounded-2xl shadow-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">MemCore</h1>
          <p className="text-sm text-gray-500 mt-1">记忆驱动的 AI 工作台</p>
        </div>

        {/* 表单 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              MS Token
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ms_xxx（去 dashboard → API Token 标签页生成）"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-red-400 text-xs">⚠️</span>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? '验证中...' : '验证并开始'}
          </button>
        </div>

        {/* 注册提示 */}
        <p className="mt-6 text-center text-xs text-gray-400">
          还没有账号？
          <a
            href="#"
            className="text-indigo-500 hover:underline ml-1 cursor-pointer"
            onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://dev.memspider.com') }}
          >请前往官网注册</a>
        </p>
      </div>
    </div>
  )
}
