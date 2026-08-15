import http from '@/services/http'
import type {
  CreateEpisodeReq,
  Episode,
  GenerateEpisodesByImportReq,
  GenerateEpisodesByPromptReq,
  ListEpisodesQuery,
  MoveEpisodeReq,
  UpdateEpisodeReq,
} from './types'

const BASE = '/api/v1/projects/:projectId/episodes'

const withProject = (projectId: number, path = '') =>
  BASE.replace(':projectId', String(projectId)) + path

export const scriptsApi = {
  async list(q: ListEpisodesQuery): Promise<Episode[]> {
    return http.get<Episode[]>(withProject(q.project_id), {
      params: { limit: q.limit, offset: q.offset },
    })
  },

  async get(projectId: number, id: number): Promise<Episode> {
    return http.get<Episode>(`${withProject(projectId)}/${id}`)
  },

  async create(req: CreateEpisodeReq): Promise<Episode> {
    return http.post<Episode>(withProject(req.project_id), req)
  },

  async update(projectId: number, id: number, req: UpdateEpisodeReq): Promise<Episode> {
    return http.put<Episode>(`${withProject(projectId)}/${id}`, req)
  },

  async remove(projectId: number, id: number): Promise<void> {
    return http.delete<void>(`${withProject(projectId)}/${id}`)
  },

  async move(projectId: number, id: number, req: MoveEpisodeReq): Promise<Episode> {
    return http.post<Episode>(`${withProject(projectId)}/${id}/move`, req)
  },

  async generateByPrompt(req: GenerateEpisodesByPromptReq): Promise<Episode[]> {
    return http.post<Episode[]>(`${withProject(req.project_id)}/generate/prompt`, req)
  },

  async generateByImport(req: GenerateEpisodesByImportReq): Promise<Episode[]> {
    return http.post<Episode[]>(`${withProject(req.project_id)}/generate/import`, req)
  },
}

export default scriptsApi
