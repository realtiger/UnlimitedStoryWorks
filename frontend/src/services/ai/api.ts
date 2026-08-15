import http from '@/services/http'
import type {
  AiBackendConfig,
  CreateAiBackendReq,
  ListAiBackendsQuery,
  UpdateAiBackendReq,
} from './types'

const BASE = '/api/v1/ai-backends'

export const aiApi = {
  async list(q?: ListAiBackendsQuery): Promise<AiBackendConfig[]> {
    return http.get<AiBackendConfig[]>(BASE, {
      params: q ?? {},
    })
  },

  async get(id: number): Promise<AiBackendConfig> {
    return http.get<AiBackendConfig>(`${BASE}/${id}`)
  },

  async create(req: CreateAiBackendReq): Promise<AiBackendConfig> {
    return http.post<AiBackendConfig>(BASE, req)
  },

  async update(id: number, req: UpdateAiBackendReq): Promise<AiBackendConfig> {
    return http.put<AiBackendConfig>(`${BASE}/${id}`, req)
  },

  async remove(id: number): Promise<void> {
    return http.delete<void>(`${BASE}/${id}`)
  },

  async setDefault(id: number): Promise<AiBackendConfig> {
    return http.post<AiBackendConfig>(`${BASE}/${id}/set-default`)
  },
}

export default aiApi
