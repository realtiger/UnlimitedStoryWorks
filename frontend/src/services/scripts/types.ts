export type StoryStyle = 'modern' | 'ancient' | 'fantasy' | 'daily'
export type StoryGenre = 'drama' | 'comedy' | 'adventure'
export type GenerateMode = 'prompt' | 'import'

export interface Episode {
  id: number
  project_id: number
  level: number
  status: string
  created_at: string
  updated_at: string
  title: string
  content: string | null
  duration_seconds: number | null
}

export interface CreateEpisodeReq {
  project_id: number
  title: string
  content?: string
}

export interface UpdateEpisodeReq {
  title?: string
  content?: string
  duration_seconds?: number
  level?: number
}

export interface MoveEpisodeReq {
  project_id: number
  direction: 'up' | 'down'
}

export interface GenerateEpisodesByPromptReq {
  project_id: number
  story_outline: string
  style: StoryStyle
  genre: StoryGenre
  episode_count: number
}

export interface GenerateEpisodesByImportReq {
  project_id: number
  file_name: string
  file_content: string
  style: StoryStyle
  genre: StoryGenre
  episode_count: number
}

export interface ListEpisodesQuery {
  project_id: number
  limit?: number
  offset?: number
}

export const STORY_STYLE_OPTIONS: { value: StoryStyle; label: string }[] = [
  { value: 'modern', label: '现代' },
  { value: 'ancient', label: '古风' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'daily', label: '日常' },
]

export const STORY_GENRE_OPTIONS: { value: StoryGenre; label: string }[] = [
  { value: 'drama', label: '剧情' },
  { value: 'comedy', label: '喜剧' },
  { value: 'adventure', label: '冒险' },
]
