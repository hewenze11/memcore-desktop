/**
 * logger.ts — 主进程日志模块
 *
 * 日志写入 userData/memcore-debug.log，同时输出到 stdout/stderr。
 * 超过 2MB 自动截断（保留后半段），防止磁盘爆满。
 * 用法：import { logger } from './logger'
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const LOG_FILE = path.join(app.getPath('userData'), 'memcore-debug.log')
const MAX_BYTES = 2 * 1024 * 1024  // 2MB

function truncateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE)
    if (stat.size > MAX_BYTES) {
      const fd = fs.openSync(LOG_FILE, 'r')
      const half = Math.floor(stat.size / 2)
      const buf = Buffer.alloc(stat.size - half)
      fs.readSync(fd, buf, 0, buf.length, half)
      fs.closeSync(fd)
      fs.writeFileSync(LOG_FILE, '--- [log rotated] ---\n' + buf.toString())
    }
  } catch { /* ignore */ }
}

function write(level: string, ...args: unknown[]) {
  const ts = new Date().toISOString()
  const line = `[${ts}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}\n`
  try { truncateIfNeeded(); fs.appendFileSync(LOG_FILE, line) } catch { /* ignore */ }
  if (level === 'ERROR') process.stderr.write(line)
  else process.stdout.write(line)
}

export const logger = {
  info:    (...args: unknown[]) => write('INFO ', ...args),
  warn:    (...args: unknown[]) => write('WARN ', ...args),
  error:   (...args: unknown[]) => write('ERROR', ...args),
  debug:   (...args: unknown[]) => write('DEBUG', ...args),
  logPath: () => LOG_FILE,
}
