import http from '@/services/http'
import type {
  CreateProjectReq,
  ListProjectsQuery,
  Project,
  UpdateProjectReq,
} from './types'

const BASE = '/api/v1/projects'

export const projectsApi = {
  async list(q?: ListProjectsQuery): Promise<Project[]> {
    return http.get<Project[]>(BASE, { params: q })
  },

  async get(id: number): Promise<Project> {
    return http.get<Project>(`${BASE}/${id}`)
  },

  async create(req: CreateProjectReq): Promise<Project> {
    return http.post<Project>(BASE, req)
  },

  async update(id: number, req: UpdateProjectReq): Promise<Project> {
    return http.put<Project>(`${BASE}/${id}`, req)
  },

  async remove(id: number): Promise<void> {
    return http.delete<void>(`${BASE}/${id}`)
  },
}

export default projectsApi
