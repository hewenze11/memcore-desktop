/**
 * logger.ts — 主进程日志模块
 *
 * - 写入 %APPDATA%/memcore-desktop/logs/YYYY-MM-DD.log
 * - 格式：[HH:MM:SS.mmm] [LEVEL] message (+ 可选 JSON data)
 * - 自动保留最近 7 天日志，启动时清理旧文件
 * - 菜单/IPC 可调用 getLogDir() / getLogPath() 让用户打开日志目录
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ── 路径 ──────────────────────────────────────────────────────────────────────

function getLogDir(): string {
  const dir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getLogPath(): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return path.join(getLogDir(), `${date}.log`)
}

// ── 旧日志清理（保留最近 7 天）─────────────────────────────────────────────────

function purgeOldLogs(): void {
  try {
    const dir = getLogDir()
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.log')).sort()
    const keep = 7
    if (files.length > keep) {
      files.slice(0, files.length - keep).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)) } catch { /* ignore */ }
      })
    }
  } catch { /* ignore */ }
}

// ── 写入 ──────────────────────────────────────────────────────────────────────

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

function write(level: Level, message: string, data?: unknown): void {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  let line = `[${time}] [${level}] ${message}`
  if (data !== undefined) {
    try { line += ' ' + JSON.stringify(data) } catch { line += ' [unserializable]' }
  }
  line += '\n'

  // 同时输出到 console（开发调试用）
  if (level === 'ERROR') console.error(line.trimEnd())
  else if (level === 'WARN') console.warn(line.trimEnd())
  else console.log(line.trimEnd())

  // 写文件（同步，主进程无需异步）
  try {
    fs.appendFileSync(getLogPath(), line, 'utf8')
  } catch { /* 写失败不崩溃，静默忽略 */ }
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

export const logger = {
  info:  (msg: string, data?: unknown) => write('INFO',  msg, data),
  warn:  (msg: string, data?: unknown) => write('WARN',  msg, data),
  error: (msg: string, data?: unknown) => write('ERROR', msg, data),
  debug: (msg: string, data?: unknown) => write('DEBUG', msg, data),
  getLogDir,
  getLogPath,
  purgeOldLogs,
}

export default logger
