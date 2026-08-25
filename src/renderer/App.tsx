import React, { useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Main from './pages/Main'
import Settings from './pages/Settings'
import MemorySpace from './pages/MemorySpace'

export default function App() {
  const [ready, setReady] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    window.electronAPI.settings.getOnboardingDone().then((res) => {
      setOnboardingDone(res.value)
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080808]">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <MemoryRouter initialEntries={[onboardingDone ? '/main' : '/onboarding']} initialIndex={0}>
      <Routes>
        <Route path="/" element={<Navigate to={onboardingDone ? '/main' : '/onboarding'} replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/main" element={<Main />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/memory/:instanceId" element={<MemorySpace />} />
      </Routes>
    </MemoryRouter>
  )
}
