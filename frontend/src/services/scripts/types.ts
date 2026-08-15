export type StoryStyle = 'modern' | 'ancient' | 'fantasy' | 'daily'
export type StoryGenre = 'drama' | 'comedy' | 'adventure'
export type GenerateMode = 'prompt' | 'import'

export const STYLE_VALUE_TO_LABEL: Record<StoryStyle, string> = {
  modern: '现代',
  ancient: '古风',
  fantasy: '奇幻',
  daily: '日常',
}
export const GENRE_VALUE_TO_LABEL: Record<StoryGenre, string> = {
  drama: '剧情',
  comedy: '喜剧',
  adventure: '冒险',
}

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
  outline: string
  style: string
  genre: string
  count: number
  ai_backend_id?: number | null
}

export interface GenerateEpisodesByImportReq {
  project_id: number
  file_ext: string
  content: string
  style_hint: string
  genre_hint: string
  ai_backend_id?: number | null
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
