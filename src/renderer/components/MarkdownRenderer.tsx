/**
 * MarkdownRenderer.tsx — AI 回复 Markdown 渲染（M5）
 *
 * 功能：代码高亮、表格、列表、加粗、行内代码、代码块复制
 */

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

// ── 代码块组件（带复制按钮）────────────────────────────────────────────────
// P0 修复：不依赖 react-markdown 的 inline prop（新版本不稳定传递）
// 用 className 判断：有 language-xxx → block code，否则 → inline code
// block code 不 String(children)，直接渲染 ReactNode 保留 rehype-highlight 注入的高亮 token

function CodeBlock({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const [copied, setCopied] = useState(false)
  // P2 修复：无语言标注的 block code 也有 hljs class（detect 模式）
  const isBlock = /language-\w+/.test(className ?? '') || /\bhljs\b/.test(className ?? '')

  // inline code：无 language class
  if (!isBlock) {
    return (
      <code
        className="bg-gray-100 text-rose-600 text-[0.85em] px-1 py-0.5 rounded font-mono"
        {...props}
      >
        {children}
      </code>
    )
  }

  // block code：提取纯文本用于复制，渲染时保留 ReactNode（保留高亮 span）
  const lang = (className ?? '').replace(/language-/, '')

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node
    if (typeof node === 'number') return String(node)  // P2 修复：number 类型 ReactNode
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (React.isValidElement(node)) return extractText((node.props as { children?: React.ReactNode }).children)
    return ''
  }

  const handleCopy = async () => {
    const text = extractText(children).replace(/\n$/, '')
    let ok = false
    // 优先 Clipboard API（需要 focus + 权限）
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); ok = true } catch { /* 降级 */ }
    }
    // 降级：execCommand（已废弃但 Electron renderer 中仍可用）
    if (!ok) {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'; el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        ok = document.execCommand('copy')
        document.body.removeChild(el)
      } catch { /* 忽略 */ }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-gray-200">
      {/* 语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800 text-gray-400 text-xs">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
        >
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      {/* 代码内容：直接渲染 children，保留 rehype-highlight 高亮 token */}
      <pre className="overflow-x-auto bg-gray-900 p-4 m-0">
        <code className={`${className ?? ''} text-sm leading-relaxed`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 代码块（inline + block 统一走 CodeBlock）
          code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
          // 段落
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          // 标题
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
          // 列表
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-2">{children}</ol>,
          li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-indigo-300 pl-3 my-2 text-gray-500 italic">{children}</blockquote>
          ),
          // 表格
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="text-sm border-collapse w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
          th: ({ children }) => <th className="border border-gray-200 px-3 py-1.5 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-3 py-1.5">{children}</td>,
          // 分割线
          hr: () => <hr className="my-3 border-gray-200" />,
          // 链接
          a: ({ href, children }) => (
            <a href={href} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // 加粗 / 斜体
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
