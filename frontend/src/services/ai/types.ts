export type AiCategory = 'text' | 'image' | 'video' | 'audio' | 'embedding'

export interface AiBackendConfig {
  id: number
  level: number
  status: string
  created_at: string
  updated_at: string
  name: string
  category: AiCategory
  base_url: string
  model_name: string
  api_key: string
  is_default: boolean
  extra: string | null
}

export interface CreateAiBackendReq {
  name: string
  category: AiCategory
  base_url: string
  model_name: string
  api_key: string
  is_default?: boolean
  extra?: string
}

export interface UpdateAiBackendReq {
  name?: string
  category?: AiCategory
  base_url?: string
  model_name?: string
  api_key?: string
  is_default?: boolean
  extra?: string
}

export interface ListAiBackendsQuery {
  category?: AiCategory
  keyword?: string
  limit?: number
  offset?: number
}


export const AI_CATEGORY_OPTIONS: {
  value: AiCategory
  label: string
  desc: string
  icon: 'text' | 'image' | 'video' | 'audio' | 'embedding'
}[] = [
  {
    value: 'text',
    label: '文本生成',
    desc: '用于生成剧本、章节大纲、台词等文本内容',
    icon: 'text',
  },
  {
    value: 'image',
    label: '图像生成',
    desc: '用于生成人物设定图、物品图、场景概念图等图像',
    icon: 'image',
  },
  {
    value: 'video',
    label: '视频生成',
    desc: '用于最终剧集的视频合成与生成',
    icon: 'video',
  },
  {
    value: 'audio',
    label: '音频生成',
    desc: '用于配音、背景音乐、音效的生成或合成',
    icon: 'audio',
  },
  {
    value: 'embedding',
    label: '向量嵌入',
    desc: '用于剧情搜索、相似度匹配、记忆检索等',
    icon: 'embedding',
  },
]
