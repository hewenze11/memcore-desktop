import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Main from './pages/Main'

export default function App() {
  const [ready, setReady] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    // 检查是否已完成引导
    window.electronAPI.settings.getOnboardingDone().then((res: { ok: boolean; value: boolean }) => {
      setOnboardingDone(res.value)
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f0f0f0]">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={onboardingDone ? '/main' : '/onboarding'} replace />}
        />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/main" element={<Main />} />
      </Routes>
    </HashRouter>
  )
}
