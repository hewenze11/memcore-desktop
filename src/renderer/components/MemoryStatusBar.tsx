/**
 * MemoryStatusBar.tsx — 底部记忆同步状态显示
 *
 * 状态：
 *   idle      → 不显示（空白）
 *   recalling → 正在召唤记忆...（灰色转圈）
 *   degraded  → 记忆服务繁忙，本轮直连模型（黄色警告）
 *   archived  → 记忆已同步（绿点，不显眼）
 *   queued    → 记忆同步延迟，稍后自动补传（灰色）
 */

import React from 'react'

export type MemoryStatus = 'idle' | 'recalling' | 'degraded' | 'archived' | 'queued'

interface Props {
  status: MemoryStatus
}

export default function MemoryStatusBar({ status }: Props) {
  if (status === 'idle') return null

  const config: Record<Exclude<MemoryStatus, 'idle'>, {
    icon: React.ReactNode
    text: string
    className: string
  }> = {
    recalling: {
      icon: (
        <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ),
      text: '正在召唤记忆...',
      className: 'text-gray-400',
    },
    degraded: {
      icon: <span className="text-amber-400">⚠</span>,
      text: '记忆服务繁忙，本轮直连模型',
      className: 'text-amber-500',
    },
    archived: {
      icon: <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />,
      text: '记忆已同步',
      className: 'text-gray-400',
    },
    queued: {
      icon: <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />,
      text: '记忆同步延迟，稍后自动补传',
      className: 'text-gray-400',
    },
  }

  const { icon, text, className } = config[status]

  return (
    <div className={`flex items-center gap-1.5 px-4 py-1 text-xs ${className}`}>
      {icon}
      <span>{text}</span>
    </div>
  )
}
