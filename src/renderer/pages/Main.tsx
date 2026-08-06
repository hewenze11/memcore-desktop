import React, { useState } from 'react'

interface Instance {
  id: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  unread: number
}

// 模拟数据（后续接真实数据）
const MOCK_INSTANCES: Instance[] = []

export default function Main() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = MOCK_INSTANCES.find((i) => i.id === selectedId) ?? null

  return (
    <div className="flex h-screen bg-white overflow-hidden select-none">
      {/* ── 左侧：实例列表 ─────────────────────────────────────────── */}
      <aside className="flex flex-col w-[280px] min-w-[220px] border-r border-gray-100 bg-[#f7f7f7]">
        {/* 顶部搜索 */}
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-200/60 rounded-lg">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索"
              className="flex-1 bg-transparent text-xs text-gray-600 outline-none placeholder-gray-400"
            />
          </div>
        </div>

        {/* 实例列表 */}
        <div className="flex-1 overflow-y-auto">
          {MOCK_INSTANCES.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">暂无实例</p>
              <p className="text-xs text-gray-300 mt-1">点击下方按钮新建</p>
            </div>
          ) : (
            MOCK_INSTANCES.map((instance) => (
              <button
                key={instance.id}
                onClick={() => setSelectedId(instance.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors ${
                  selectedId === instance.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                    {instance.avatar}
                  </div>
                  {instance.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">
                      {instance.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 truncate">{instance.name}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{instance.time}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{instance.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* 底部：新建按钮 */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition-colors"
            onClick={() => {
              // TODO: 新建实例逻辑
              console.log('新建实例')
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建实例
          </button>
        </div>
      </aside>

      {/* ── 右侧：聊天区 ───────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0">
        {selected ? (
          <>
            {/* 聊天顶栏 */}
            <header className="flex items-center px-5 py-3 border-b border-gray-100 bg-white">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm mr-3">
                {selected.avatar}
              </div>
              <span className="font-medium text-gray-800">{selected.name}</span>
            </header>

            {/* 消息区（空） */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#f9f9f9]">
              {/* 消息列表 */}
            </div>

            {/* 输入框 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  placeholder="输入消息..."
                  rows={1}
                  className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all max-h-32"
                />
                <button className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition-colors">
                  发送
                </button>
              </div>
            </div>
          </>
        ) : (
          /* 未选中时的欢迎页 */
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
    </div>
  )
}
