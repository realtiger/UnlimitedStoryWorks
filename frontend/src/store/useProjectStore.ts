import { create } from 'zustand'
import type { Project } from '@/services/projects/types'
import type { Episode } from '@/services/scripts/types'

interface ProjectState {
  selectedProject: Project | null
  selectedEpisode: Episode | null
  selectProject: (project: Project | null) => void
  selectEpisode: (episode: Episode | null) => void
  clearProject: () => void
  clearEpisode: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedProject: null,
  selectedEpisode: null,

  selectProject: (project) => set({ selectedProject: project, selectedEpisode: null }),

  selectEpisode: (episode) => set({ selectedEpisode: episode }),

  clearProject: () => set({ selectedProject: null, selectedEpisode: null }),

  clearEpisode: () => set({ selectedEpisode: null }),
}))
