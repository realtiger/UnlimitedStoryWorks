/**
 * 基于原生 fetch 的 HTTP 客户端封装（项目没装 axios）
 *
 * 所有后端接口都会返回统一结构：
 *   { code, success, message, data }
 *
 * 本封装：
 *   - 自动加 Content-Type: application/json
 *   - 自动把后端 body 解析成 ApiResponse<T>
 *   - 若 success=false 直接抛错（message 作为错误信息，code 附在 err.code 上）
 *   - 若 HTTP 513（茶壶错误）也按上述统一结构解析
 *   - 可通过 useQueryLoader 传 signal 支持取消
 *
 * 若未来接入 axios，只需替换本文件实现，页面层不用改。
 */

export interface ApiResponseEnvelope<T> {
  code: string
  success: boolean
  message: string
  data: T | null
}

export class ApiError extends Error {
  public code: string
  public statusCode: number
  public data: unknown

  constructor(message: string, code: string, statusCode: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
    this.data = data ?? null
  }
}

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  /** 传 true 时 response.success=false 不抛错，让调用方自己处理 */
  swallowError?: boolean
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

function buildUrl(url: string, params?: FetchOptions['params']): string {
  const finalUrl = url.startsWith('http')
    ? url
    : url.startsWith('/')
      ? url
      : `/${url}`

  if (!params) return finalUrl

  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    usp.append(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}${qs}` : finalUrl
}

export async function request<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { params, body, headers, swallowError, ...init } = options

  const finalUrl = buildUrl(url, params)
  const mergedHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...Object.fromEntries(
      (headers instanceof Headers
        ? Array.from(headers.entries())
        : Object.entries(headers ?? {})
      ).map(([k, v]) => [k, String(v)])
    ),
  }
  // 如果 body 是 FormData/Blob，不要自动带 Content-Type（让浏览器设 boundary）
  const hasRawBody =
    typeof body !== 'undefined' &&
    (body instanceof FormData ||
      body instanceof Blob ||
      (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer))

  if (hasRawBody) {
    delete mergedHeaders['Content-Type']
  }

  const resp = await fetch(finalUrl, {
    ...init,
    headers: mergedHeaders,
    body: hasRawBody
      ? (body as BodyInit)
      : typeof body === 'undefined'
        ? undefined
        : JSON.stringify(body),
  })

  // 解析 body（任何 HTTP 状态都尝试按 JSON 读）
  let envelope: ApiResponseEnvelope<T>
  try {
    const text = await resp.text()
    if (!text) {
      envelope = {
        code: resp.ok ? 'E00001' : 'E00000',
        success: resp.ok,
        message: resp.statusText || '',
        data: null,
      }
    } else {
      envelope = JSON.parse(text) as ApiResponseEnvelope<T>
    }
  } catch (err) {
    throw new ApiError(
      `响应体非 JSON：${(err as Error).message}`,
      'E00000',
      resp.status
    )
  }

  // 业务逻辑错误
  if (!envelope.success && !swallowError) {
    throw new ApiError(
      envelope.message || '请求失败',
      envelope.code,
      resp.status,
      envelope.data
    )
  }

  // success=true 但 HTTP 非 2xx（极端情况），按 envelope.success 优先
  return envelope.data as T
}

export const http = {
  get: <T>(url: string, options?: FetchOptions) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { ...options, method: 'POST', body }),

  put: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { ...options, method: 'PUT', body }),

  patch: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { ...options, method: 'PATCH', body }),

  delete: <T>(url: string, options?: FetchOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),

  raw: <T>(url: string, options?: FetchOptions) =>
    request<T>(url, options),
}

export default http
