import { create } from 'zustand'
import {
  fetchAllMenu,
  fetchFooterLinks,
  fetchHeaderMenu,
  fetchSidebarMenu,
  type FooterLink,
  type HeaderNavItem,
  type SidebarSection,
} from '@/services/menu'

interface MenuState {
  isLoading: boolean
  error: string | null
  headerNav: HeaderNavItem[]
  sidebarSections: SidebarSection[]
  footerLinks: FooterLink[]
  loadAll: () => Promise<void>
  loadHeaderMenu: () => Promise<void>
  loadSidebarMenu: () => Promise<void>
  loadFooterLinks: () => Promise<void>
  setHeaderNav: (items: HeaderNavItem[]) => void
  setSidebarSections: (sections: SidebarSection[]) => void
  setFooterLinks: (links: FooterLink[]) => void
  setAll: (data: {
    headerNav?: HeaderNavItem[]
    sidebarSections?: SidebarSection[]
    footerLinks?: FooterLink[]
  }) => void
}

export const useMenuStore = create<MenuState>((set) => ({
  isLoading: false,
  error: null,
  headerNav: [],
  sidebarSections: [],
  footerLinks: [],

  loadAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await fetchAllMenu()
      set({ ...data, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  loadHeaderMenu: async () => {
    set({ isLoading: true, error: null })
    try {
      set({ headerNav: await fetchHeaderMenu(), isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  loadSidebarMenu: async () => {
    set({ isLoading: true, error: null })
    try {
      set({ sidebarSections: await fetchSidebarMenu(), isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  loadFooterLinks: async () => {
    set({ isLoading: true, error: null })
    try {
      set({ footerLinks: await fetchFooterLinks(), isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  setHeaderNav: (items) => set({ headerNav: items }),
  setSidebarSections: (sections) => set({ sidebarSections: sections }),
  setFooterLinks: (links) => set({ footerLinks: links }),

  setAll: (data) =>
    set((prev) => ({
      headerNav: data.headerNav ?? prev.headerNav,
      sidebarSections: data.sidebarSections ?? prev.sidebarSections,
      footerLinks: data.footerLinks ?? prev.footerLinks,
    })),
}))
