/**
 * 基于 axios 的 HTTP 客户端封装
 *
 * 统一 ApiResponse<T> 信封：{ code, success, message, data }
 *   - code = "S00000" + success=true  = 业务成功，直接返回 data
 *   - code = "E{类别2位}{序号3位}" + success=false = 业务错误
 *
 * 行为（调用方不用重复写）：
 *   1. Content-Type: application/json（FormData/Blob 会自动剥掉让浏览器带 boundary）
 *   2. success=false 或 HTTP 非 2xx：
 *        - 默认：全局 toast.error + beep 鸣响 + throw ApiError
 *        - swallowError=true：只抛 ApiError，不让全局 toast（表单要内联展示错误时用）
 *        - silent=true：完全静默，不 toast 也不 console
 */

import axios from 'axios'
import type {
  AxiosError as _AxiosError,
  AxiosInstance as _AxiosInstance,
  AxiosRequestConfig as _AxiosRequestConfig,
} from 'axios'
import { toast } from '@/components/ui/toast'

type AxiosError<T = unknown, D = unknown> = _AxiosError<T, D>
type AxiosInstance = _AxiosInstance
type AxiosRequestConfig<T = unknown> = _AxiosRequestConfig<T>

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

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

export interface HttpConfig<D = unknown> extends AxiosRequestConfig<D> {
  /** true = 只抛 ApiError，不全局 toast（表单内联展示错误时用） */
  swallowError?: boolean
  /** true = 完全静默，既不 toast 也不 console */
  silent?: boolean
}

// ---------------------------------------------------------------------------
// 鸣响：轻量 beep（没权限/不支持就静默）
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      ((
        window as unknown as {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext as typeof AudioContext)
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    const ctx = audioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      try {
        osc.disconnect()
        gain.disconnect()
      } catch {
        /* noop */
      }
    }, 360)
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// axios 实例 + request interceptor（FormData/Blob 剥 Content-Type）
// ---------------------------------------------------------------------------

const instance: AxiosInstance = axios.create({
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

instance.interceptors.request.use((cfg) => {
  const body = cfg.data
  const isRaw =
    typeof body !== 'undefined' &&
    (body instanceof FormData ||
      body instanceof Blob ||
      (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer))
  if (isRaw) {
    // 存在，让浏览器自动带 multipart boundary
    delete cfg.headers?.['Content-Type']
  }
  return cfg
})

// ---------------------------------------------------------------------------
// 统一错误处理（toast + beep + console）
// ---------------------------------------------------------------------------

function notifyError(err: ApiError, silent: boolean, swallow: boolean) {
  if (silent) return
  if (swallow) return

  console.error(
    '%c========== HTTP 请求错误 ==========',
    'color: #ff4d4f; font-weight: bold; font-size: 14px;'
  )
  console.error('%c错误代码: ', 'color: #ff7a45; font-weight: bold;', err.code)
  console.error('%c状态码:   ', 'color: #ff7a45; font-weight: bold;', err.statusCode)
  console.error('%c错误信息: ', 'color: #ff7a45; font-weight: bold;', err.message)
  console.error('%c附加数据: ', 'color: #ff7a45; font-weight: bold;', err.data)
  console.error(
    '%c==================================',
    'color: #ff4d4f; font-weight: bold; font-size: 14px;'
  )

  try {
    toast.add({
      type: 'error',
      title: `请求失败 [${err.code || 'ERR'}]`,
      description: err.message || '未知错误，请稍后重试',
      timeout: 5000,
      priority: 'high',
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[toast.add failed]', e)
  }
  try {
    beep()
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// 核心 request<T>：只接受 axios config，不再单独传 url/method/body
// ---------------------------------------------------------------------------

export async function request<T>(config: HttpConfig): Promise<T> {
  const { swallowError, silent, ...rest } = config

  try {
    const resp = await instance.request<ApiResponseEnvelope<T>>(rest)
    const envelope = resp.data

    if (!envelope) {
      throw new ApiError('响应体为空', 'E00000', resp.status ?? 200)
    }
    if (!envelope.success) {
      throw new ApiError(
        envelope.message || '请求失败',
        envelope.code || 'E00000',
        resp.status ?? 513,
        envelope.data,
      )
    }
    return envelope.data as T
  } catch (caught) {
    if (caught instanceof ApiError) {
      notifyError(caught, !!silent, !!swallowError)
      throw caught
    }

    let statusCode = 0
    let code = 'E99999'
    let message = '网络异常，请检查连接后重试'
    let data: unknown = null

    if (axios.isAxiosError(caught)) {
      const axErr = caught as AxiosError<ApiResponseEnvelope<unknown>>
      statusCode = axErr.response?.status ?? 0
      const env = axErr.response?.data
      if (env && typeof env === 'object' && 'success' in env && !env.success) {
        code = env.code || 'E99999'
        message = env.message || axErr.message
        data = env.data ?? null
      } else if (axErr.code === 'ERR_NETWORK') {
        code = 'E99998'
        message = '无法连接到后端（请确认 Rust 后端是否启动、端口 5000 是否可达）'
      } else if (axErr.code === 'ETIMEDOUT') {
        code = 'E99997'
        message = `请求超时（${instance.defaults.timeout}ms）`
      } else {
        code = `E${String(axErr.response?.status ?? 99999).padStart(5, '0')}`
        message = axErr.message || message
      }
    } else if (caught instanceof Error) {
      message = caught.message
    }

    const err = new ApiError(message, code, statusCode, data)
    notifyError(err, !!silent, !!swallowError)
    throw err
  }
}

// ---------------------------------------------------------------------------
// 便捷方法：直接转 axios config（不再二次 merge {body: ...}）
// ---------------------------------------------------------------------------

export const http = {
  get: <T>(url: string, config?: HttpConfig) =>
    request<T>({ ...config, method: 'GET', url }),

  post: <T>(url: string, data?: unknown, config?: HttpConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),

  put: <T>(url: string, data?: unknown, config?: HttpConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),

  patch: <T>(url: string, data?: unknown, config?: HttpConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T>(url: string, config?: HttpConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),

  /** 原始 request（需要自定义 method/baseURL/headers 时用） */
  request: <T>(config: HttpConfig) => request<T>(config),

  /** 原始 axios 实例（自定义拦截器/上传进度等高级用法） */
  instance,
}

export default http
