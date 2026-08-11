import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar'
import { Header } from './Header'
import { LayoutSidebar } from './Sidebar'
import { Footer } from './Footer'
import type { HeaderProps } from './Header'
import type { FooterProps } from './Footer'
import type { SidebarProps } from './Sidebar'
import { useMenuStore } from '@/store/useMenuStore'

export interface LayoutProps {
  className?: string
  variant?: 'default' | 'sidebar-only' | 'minimal'
  header?: HeaderProps & { enabled?: boolean }
  sidebar?: SidebarProps & { enabled?: boolean }
  footer?: FooterProps & { enabled?: boolean }
  children?: React.ReactNode
}

export function Layout({
  className,
  variant = 'default',
  header: headerProps,
  sidebar: sidebarProps,
  footer: footerProps,
  children,
}: LayoutProps) {
  const { enabled: headerEnabled = true, ...headerRest } = headerProps ?? {}
  const {
    enabled: sidebarEnabledProp = true,
    sections: propSections,
    brand,
    footer: sidebarFooter,
    ...sidebarRest
  } = sidebarProps ?? {}

  const {
    loadAll,
    sidebarSections,
    footerLinks,
  } = useMenuStore()

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const sidebarEnabled =
    sidebarEnabledProp &&
    (variant === 'sidebar-only' || variant === 'default')

  const footerEnabled = footerProps?.enabled ?? variant !== 'minimal'

  const finalSidebarSections = propSections ?? sidebarSections

  return (
    <div
      className={cn(
        'flex min-h-svh w-full flex-col bg-background',
        className
      )}
    >
      {headerEnabled && <Header {...headerRest} />}

      <SidebarProvider defaultOpen={sidebarEnabled && variant === 'default'}>
        <div className="flex flex-1 w-full">
          {sidebarEnabled && finalSidebarSections.length > 0 && (
            <LayoutSidebar
              sections={finalSidebarSections}
              brand={brand}
              footer={sidebarFooter}
              className="!top-16 !h-[calc(100svh-4rem)] [&_[data-slot=sidebar-inner]]:!h-full"
              {...sidebarRest}
            />
          )}

          <SidebarInset>
            <div className="flex-1 min-h-0 w-full p-4 md:p-6 lg:p-8">
              {children ?? <Outlet />}
            </div>

            {footerEnabled && (
              <Footer links={footerLinks} {...footerProps} />
            )}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}

export {
  Header,
  LayoutSidebar as Sidebar,
  Footer,
}
