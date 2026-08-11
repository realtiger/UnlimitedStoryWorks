import { NavLink } from 'react-router-dom'
import {
  Moon02Icon,
  Sun02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { useLayoutStore } from '@/store/useLayoutStore'
import { useMenuStore } from '@/store/useMenuStore'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'

export interface HeaderNavItem {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string; 'data-icon'?: string }>
  disabled?: boolean
}

export interface HeaderProps {
  className?: string
  title?: string
  logoSrc?: string
  logoAlt?: string
  showThemeToggle?: boolean
  showNav?: boolean
  navItems?: HeaderNavItem[]
  actions?: React.ReactNode
}

export function Header({
  className,
  title = 'Unlimited Story Works',
  logoSrc = '/logo.png',
  logoAlt = 'Logo',
  showThemeToggle = true,
  showNav = true,
  navItems,
  actions,
}: HeaderProps) {
  const { theme, toggleTheme } = useLayoutStore()
  const storeNav = useMenuStore((s) => s.headerNav)
  const items = navItems ?? storeNav

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 shrink-0 w-full items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {logoSrc && (
          <img
            src={logoSrc}
            alt={logoAlt}
            className="size-8 shrink-0 rounded-md object-contain"
          />
        )}
        <span className="text-sm font-semibold tracking-tight sm:text-base">
          {title}
        </span>
      </div>

      {showNav && items.length > 0 && (
        <div className="ml-4 hidden lg:block">
          <NavigationMenu>
            <NavigationMenuList className="gap-1">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <NavigationMenuItem key={item.href}>
                    <NavigationMenuLink
                      render={({ className: linkClassName, ...props }) => (
                        <NavLink
                          to={item.href}
                          end={item.href === '/'}
                          className={({ isActive }) =>
                            cn(
                              navigationMenuTriggerStyle(),
                              linkClassName,
                              isActive &&
                                'bg-accent text-accent-foreground hover:bg-accent focus:bg-accent',
                              item.disabled &&
                                'pointer-events-none opacity-50'
                            )
                          }
                          {...props}
                        >
                          {Icon && <Icon data-icon="inline-start" />}
                          <span>{item.label}</span>
                        </NavLink>
                      )}
                    />
                  </NavigationMenuItem>
                )
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      )}

      <div className="flex-1" />

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-1 sm:gap-2">
        {showThemeToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'
            }
          >
            {theme === 'dark' ? (
              <HugeiconsIcon icon={Sun02Icon} />
            ) : (
              <HugeiconsIcon icon={Moon02Icon} />
            )}
          </Button>
        )}
      </div>
    </header>
  )
}
