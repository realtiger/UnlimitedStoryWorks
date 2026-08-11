import {
  Home01Icon,
  InformationCircleIcon,
  Book02Icon,
  SparklesIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { HeaderNavItem } from '@/components/layout/Header'
import type { SidebarSection } from '@/components/layout/Sidebar'
import type { FooterLink } from '@/components/layout/Footer'

export interface MenuItemIconProps {
  className?: string
  'data-icon'?: string
}
export type MenuItemIcon = React.ComponentType<MenuItemIconProps>

export { type HeaderNavItem, type SidebarSection, type FooterLink }

export async function fetchHeaderMenu(): Promise<HeaderNavItem[]> {
  return [
    {
      label: '首页',
      href: '/',
      icon: ({ className, ...props }) => (
        <HugeiconsIcon icon={Home01Icon} className={className} {...props} />
      ),
    },
    {
      label: '关于',
      href: '/about',
      icon: ({ className, ...props }) => (
        <HugeiconsIcon
          icon={InformationCircleIcon}
          className={className}
          {...props}
        />
      ),
    },
  ]
}

export async function fetchSidebarMenu(): Promise<SidebarSection[]> {
  return [
    {
      title: '主菜单',
      items: [
        {
          label: '首页',
          href: '/',
          icon: ({ className, ...props }) => (
            <HugeiconsIcon icon={Home01Icon} className={className} {...props} />
          ),
        },
        {
          label: '故事创作',
          href: '/stories',
          icon: ({ className, ...props }) => (
            <HugeiconsIcon icon={Book02Icon} className={className} {...props} />
          ),
          badge: 3,
        },
        {
          label: '创作中心',
          icon: ({ className, ...props }) => (
            <HugeiconsIcon icon={SparklesIcon} className={className} {...props} />
          ),
          children: [
            { label: '新建故事', href: '/stories/new' },
            { label: '我的草稿', href: '/stories/drafts' },
            { label: '已发布', href: '/stories/published' },
          ],
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          label: '关于我们',
          href: '/about',
          icon: ({ className, ...props }) => (
            <HugeiconsIcon
              icon={InformationCircleIcon}
              className={className}
              {...props}
            />
          ),
        },
        {
          label: '设置',
          href: '/settings',
          icon: ({ className, ...props }) => (
            <HugeiconsIcon icon={Settings01Icon} className={className} {...props} />
          ),
        },
      ],
    },
  ]
}

export async function fetchFooterLinks(): Promise<FooterLink[]> {
  return [
    { label: '功能介绍', href: '/features' },
    { label: '定价', href: '/pricing' },
    { label: '更新日志', href: '/changelog' },
    { label: '文档', href: '/docs' },
    { label: '帮助中心', href: '/help' },
    { label: '关于我们', href: '/about' },
    { label: '隐私政策', href: '/privacy' },
    { label: '服务条款', href: '/terms' },
  ]
}

export async function fetchAllMenu() {
  const [headerNav, sidebarSections, footerLinks] = await Promise.all([
    fetchHeaderMenu(),
    fetchSidebarMenu(),
    fetchFooterLinks(),
  ])
  return { headerNav, sidebarSections, footerLinks }
}
