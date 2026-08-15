import http from '@/services/http'
import { ApiError } from '@/services/http'
import type {
  CreateEpisodeReq,
  Episode,
  GenerateEpisodesByImportReq,
  GenerateEpisodesByPromptReq,
  ListEpisodesQuery,
  MoveEpisodeReq,
  UpdateEpisodeReq,
} from './types'

const V1_BASE = '/api/v1/episodes'

export interface GenerateHeartbeat {
  elapsed_ms: number
  stage: 'prepare_prompt' | 'calling_llm' | 'bulk_create'
  progress?: number
}

export type GenerateProgressCb = (hb: GenerateHeartbeat) => void

interface SseEnvelopeDone<T> {
  code: string
  success: boolean
  message: string
  data: T | null
}
interface SseEnvelopeError {
  code: string
  message: string
}

async function postSseStream<T>(
  url: string,
  body: unknown,
  onProgress?: GenerateProgressCb,
): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    let code = `E${String(resp.status).padStart(5, '0')}`
    try {
      const env = (await resp.json()) as SseEnvelopeDone<unknown>
      if (env && !env.success) {
        message = env.message || message
        code = env.code || code
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, code, resp.status)
  }
  if (!resp.body) {
    throw new ApiError('响应体为空', 'E00000', resp.status)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let lastEvent = 'message'
  let resolved = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx: number
      while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)
        let dataText = ''
        for (const line of raw.split('\n')) {
          if (!line) continue
          if (line.startsWith('event:')) {
            lastEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const piece = line.slice(5)
            dataText += (dataText ? '\n' : '') + (piece.startsWith(' ') ? piece.slice(1) : piece)
          }
        }
        if (!dataText) continue
        switch (lastEvent) {
          case 'heartbeat': {
            if (onProgress) {
              try {
                const hb = JSON.parse(dataText) as GenerateHeartbeat
                onProgress(hb)
              } catch {
                /* ignore malformed heartbeat */
              }
            }
            break
          }
          case 'error': {
            const err = JSON.parse(dataText) as SseEnvelopeError
            throw new ApiError(err.message, err.code, 513)
          }
          case 'done': {
            const env = JSON.parse(dataText) as SseEnvelopeDone<T>
            if (!env.success) {
              throw new ApiError(env.message, env.code, 513, env.data)
            }
            resolved = true
            return env.data as T
          }
        }
      }
    }
    if (!resolved) {
      throw new ApiError('流未返回完成事件', 'E99999', 500)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }
  throw new ApiError('流未返回完成事件', 'E99999', 500)
}

export const scriptsApi = {
  async list(q: ListEpisodesQuery): Promise<Episode[]> {
    return http.get<Episode[]>(V1_BASE, {
      params: { project_id: q.project_id, limit: q.limit, offset: q.offset },
    })
  },

  async get(_projectId: number, id: number): Promise<Episode> {
    return http.get<Episode>(`${V1_BASE}/${id}`)
  },

  async create(req: CreateEpisodeReq): Promise<Episode> {
    return http.post<Episode>(V1_BASE, req)
  },

  async update(_projectId: number, id: number, req: UpdateEpisodeReq): Promise<Episode> {
    return http.put<Episode>(`${V1_BASE}/${id}`, req)
  },

  async remove(_projectId: number, id: number): Promise<void> {
    return http.delete<void>(`${V1_BASE}/${id}`)
  },

  async move(_projectId: number, id: number, req: MoveEpisodeReq): Promise<Episode> {
    return http.post<Episode>(`${V1_BASE}/${id}/move`, {
      direction: req.direction,
    })
  },

  async generateByPrompt(req: GenerateEpisodesByPromptReq): Promise<Episode[]> {
    return http.post<Episode[]>(`${V1_BASE}/generate-by-prompt`, req)
  },

  async generateByImport(req: GenerateEpisodesByImportReq): Promise<Episode[]> {
    return http.post<Episode[]>(`${V1_BASE}/generate-by-import`, req)
  },

  async generateByPromptStream(
    req: GenerateEpisodesByPromptReq,
    onProgress?: GenerateProgressCb,
  ): Promise<Episode[]> {
    return postSseStream<Episode[]>(
      `${V1_BASE}/stream/generate-by-prompt`,
      req,
      onProgress,
    )
  },

  async generateByImportStream(
    req: GenerateEpisodesByImportReq,
    onProgress?: GenerateProgressCb,
  ): Promise<Episode[]> {
    return postSseStream<Episode[]>(
      `${V1_BASE}/stream/generate-by-import`,
      req,
      onProgress,
    )
  },
}

export default scriptsApi
