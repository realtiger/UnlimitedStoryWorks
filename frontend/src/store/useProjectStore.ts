import { create } from 'zustand'
import type { Project } from '@/services/projects/types'

interface ProjectState {
  selectedProject: Project | null
  selectProject: (project: Project | null) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedProject: null,

  selectProject: (project) => set({ selectedProject: project }),

  clearProject: () => set({ selectedProject: null }),
}))
