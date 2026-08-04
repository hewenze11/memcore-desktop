/**
 * ipc.ts — IPC handler 注册（安全加固版）
 *
 * 安全措施：
 * - image:upload：只允许上传 image:pick 返回过的路径（session 白名单，用完即删）
 * - image:toBase64：URL 必须是合法 http/https scheme + 允许的 host，防 SSRF
 * - config:save：apiBaseUrl 的 hostname 只允许白名单内的 host
 * - httpRequest：响应体限制 1MB，防内存耗尽
 * - image:toBase64：限制 5MB，防 OOM
 */

import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { loadConfig, saveConfig, AppConfig } from './keychain'
import FormData from 'form-data'

// ── 允许的 API host 白名单（防 config:save 劫持凭据）
const ALLOWED_API_HOSTS = new Set([
  '172.236.254.239',
  '172.236.254.94',
  'api.cayan.ai',
  'localhost',
  '127.0.0.1',
])

// ── 允许的图片下载 host 白名单（防 SSRF）
// MinIO 跑在数据库专机，内网地址
const ALLOWED_IMAGE_HOSTS = new Set([
  '172.236.224.19',  // 数据库专机 MinIO
  '172.236.254.239', // 测试集群（开发期）
  '172.236.254.94',  // 生产集群
  'oss.cayan.ai',    // 未来 CDN 域名占位
])

// ── session 级别文件路径白名单（image:pick → image:upload 一次性消费）
const allowedUploadPaths = new Set<string>()

// 响应体上限：1MB（JSON 响应足够，防恶意服务器撑爆内存）
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024
// 图片下载上限：5MB（转 base64 后约 6.7MB，3张约 20MB，在安全范围内）
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// ── 配置 ──────────────────────────────────────────────────────────────────────

ipcMain.handle('config:load', async () => {
  return await loadConfig()
})

ipcMain.handle('config:save', async (_event, patch: Partial<AppConfig>) => {
  // P1-1 修复：校验 apiBaseUrl 的 hostname，防止被篡改为恶意服务器
  if (patch.apiBaseUrl !== undefined) {
    try {
      const parsed = new URL(patch.apiBaseUrl)
      if (!ALLOWED_API_HOSTS.has(parsed.hostname)) {
        throw new Error(`apiBaseUrl host not allowed: ${parsed.hostname}`)
      }
    } catch (e: any) {
      if (e.message.includes('not allowed')) throw e
      throw new Error(`invalid apiBaseUrl: ${patch.apiBaseUrl}`)
    }
  }
  await saveConfig(patch)
  return { ok: true }
})

// ── 图片 ──────────────────────────────────────────────────────────────────────

/**
 * P0-1 修复：文件选择由主进程弹对话框，返回的路径注册到 session 白名单。
 * image:upload 只允许上传白名单内的路径，用完即删。
 */
ipcMain.handle('image:pick', async (_event, opts?: { multiple?: boolean }) => {
  const result = await dialog.showOpenDialog({
    title: '选择图片',
    properties: opts?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const paths = result.filePaths.slice(0, 3)
  // 注册到 session 白名单（只有 image:pick 返回的路径才可上传）
  paths.forEach(fp => allowedUploadPaths.add(fp))

  return paths.map(fp => ({
    filePath: fp,
    fileName: path.basename(fp),
    sizeMB: +(fs.statSync(fp).size / 1024 / 1024).toFixed(2),
  }))
})

/**
 * P0-1 修复：只允许上传 image:pick 登记过的路径，用完即从白名单删除（防重放）
 */
ipcMain.handle(
  'image:upload',
  async (
    _event,
    params: { filePath: string; workspaceId?: string; note?: string; sessionId?: string }
  ) => {
    const config = await loadConfig()
    if (!config.jwtToken) throw new Error('not logged in')

    // 路径白名单校验
    if (!allowedUploadPaths.has(params.filePath)) {
      throw new Error('Unauthorized file path: must be selected via image:pick')
    }
    // 用完即删（防重放攻击）
    allowedUploadPaths.delete(params.filePath)

    const fileBuffer = fs.readFileSync(params.filePath)
    const fileName = path.basename(params.filePath)
    const ext = path.extname(fileName).toLowerCase().slice(1) as string
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
    }
    const mimeType = mimeMap[ext] || 'application/octet-stream'

    const form = new FormData()
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType })
    if (params.workspaceId) form.append('workspace_id', params.workspaceId)
    if (params.note) form.append('note', params.note)
    if (params.sessionId) form.append('session_id', params.sessionId)

    const apiUrl = new URL('/memory/upload-image', config.apiBaseUrl)
    const responseBody = await httpRequest({
      url: apiUrl.toString(),
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${config.jwtToken}`,
      },
      body: form.getBuffer(),
    })
    return JSON.parse(responseBody)
  }
)

/**
 * 获取图片预签名 URL（15分钟有效）
 */
ipcMain.handle('image:getUrl', async (_event, objectKey: string) => {
  const config = await loadConfig()
  if (!config.jwtToken) throw new Error('not logged in')

  const apiUrl = new URL(
    `/memory/image-url?object_key=${encodeURIComponent(objectKey)}`,
    config.apiBaseUrl
  )
  const responseBody = await httpRequest({
    url: apiUrl.toString(),
    method: 'GET',
    headers: { Authorization: `Bearer ${config.jwtToken}` },
  })
  return JSON.parse(responseBody)
})

/**
 * P0-3 修复：URL 白名单校验，防 SSRF
 * P1-2 修复：限制 5MB，防 OOM
 * P2 修复：根据响应 Content-Type 生成正确的 data URL prefix
 */
ipcMain.handle('image:toBase64', async (_event, url: string) => {
  // SSRF 防护：只允许 http/https，且 hostname 在白名单内
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Image host not allowed: ${parsed.hostname}`)
  }

  const { data, contentType } = await httpDownloadWithType(url, MAX_IMAGE_BYTES)
  // 使用实际 Content-Type 避免 MIME 错误
  const mime = contentType?.split(';')[0]?.trim() || 'image/jpeg'
  return `data:${mime};base64,${data.toString('base64')}`
})

// ── Auth ──────────────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_event, params: { email: string; code: string }) => {
  const config = await loadConfig()
  const loginUrl = new URL('/api/auth/login', config.apiBaseUrl)
  const body = JSON.stringify({ email: params.email, code: params.code })
  const responseBody = await httpRequest({
    url: loginUrl.toString(),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.from(body),
  })
  const result = JSON.parse(responseBody)
  if (result.token) {
    await saveConfig({ jwtToken: result.token })
  }
  return result
})

ipcMain.handle('auth:logout', async () => {
  await saveConfig({ jwtToken: null })
  return { ok: true }
})

ipcMain.handle('auth:status', async () => {
  const config = await loadConfig()
  return { loggedIn: !!config.jwtToken }
})

// ── 工具函数 ──────────────────────────────────────────────────────────────────

interface RequestOptions {
  url: string
  method: string
  headers?: Record<string, string>
  body?: Buffer
}

/**
 * P1-4 修复：响应体限制 MAX_RESPONSE_BYTES（1MB），防恶意服务器撑爆内存
 */
function httpRequest(opts: RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.url)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: opts.method,
        headers: opts.headers || {},
        timeout: 30000,
      },
      (res) => {
        const chunks: Buffer[] = []
        let totalBytes = 0

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy()
            reject(new Error(`Response too large (>${MAX_RESPONSE_BYTES} bytes)`))
            return
          }
          chunks.push(chunk)
        })

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`))
          } else {
            resolve(body)
          }
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('request timeout')) })
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

/**
 * 下载二进制数据，带大小限制，返回 Buffer + Content-Type
 */
function httpDownloadWithType(
  url: string,
  maxBytes: number
): Promise<{ data: Buffer; contentType: string | null }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === 'https:'
    const lib = isHttps ? https : http

    const req = lib.get(url, (res) => {
      const contentType = res.headers['content-type'] || null
      const chunks: Buffer[] = []
      let total = 0

      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > maxBytes) {
          req.destroy()
          reject(new Error(`Image too large: exceeds ${maxBytes} bytes`))
          return
        }
        chunks.push(chunk)
      })

      res.on('end', () => resolve({ data: Buffer.concat(chunks), contentType }))
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('download timeout')) })
  })
}

export {}
