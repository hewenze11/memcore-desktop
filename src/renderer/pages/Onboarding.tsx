import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  // 倒计时
  React.useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSendCode = async () => {
    const phone_re = /^1[3-9]\d{9}$/
    if (!phone_re.test(phone)) {
      setError('请输入正确的中国大陆手机号')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.auth.sendCode(phone.trim())
      if (result.ok) {
        setStep('code')
        setCountdown(60)
      } else {
        setError(result.error || '发送失败，请重试')
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('请输入 6 位验证码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.auth.loginWithCode(phone.trim(), code.trim())
      if (result.ok) {
        navigate('/main')
      } else {
        setError(result.error || '验证码不正确，请重试')
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setError('')
    setLoading(true)
    try {
      const result = await window.electronAPI.auth.sendCode(phone.trim())
      if (result.ok) {
        setCountdown(60)
      } else {
        setError(result.error || '发送失败')
      }
    } finally {
      setLoading(false)
    }
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

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                placeholder="请输入中国大陆手机号"
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
              onClick={handleSendCode}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>

            <p className="text-xs text-center text-gray-400">
              没有账号？
              <a
                href="#"
                className="text-indigo-500 hover:underline ml-1 cursor-pointer"
                onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://dev.memspider.com') }}
              >前往官网注册</a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">验证码</label>
                <button
                  onClick={() => { setStep('phone'); setCode(''); setError('') }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ← 修改手机号
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">已发送至 {phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')}</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="请输入 6 位验证码"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-300 tracking-widest text-center text-lg"
                autoFocus
                maxLength={6}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                <span className="text-red-400 text-xs">⚠️</span>
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading ? '验证中...' : '登录'}
            </button>

            <button
              onClick={handleResend}
              disabled={countdown > 0 || loading}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 disabled:text-gray-300 transition-colors"
            >
              {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
