export interface Project {
  id: number
  level: number
  status: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  cover_image: string | null
}

export interface CreateProjectReq {
  name: string
  description?: string
  cover_image?: string
}

export interface UpdateProjectReq {
  name?: string
  description?: string
  cover_image?: string
  level?: number
}

export interface ListProjectsQuery {
  keyword?: string
  limit?: number
  offset?: number
}
