import { NavLink, useNavigate } from 'react-router-dom'
import {
  Moon02Icon,
  Sun02Icon,
  FolderIcon,
  ExchangeIcon,
  Book02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { useLayoutStore } from '@/store/useLayoutStore'
import { useMenuStore } from '@/store/useMenuStore'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const navigate = useNavigate()
  const { theme, toggleTheme } = useLayoutStore()
  const storeNav = useMenuStore((s) => s.headerNav)
  const { selectedProject, selectedEpisode } = useProjectStore()
  const items = navItems ?? storeNav

  const handleProjectClick = () => {
    navigate('/projects')
  }

  const handleEpisodeClick = () => {
    if (!selectedProject) return
    navigate('/scripts')
  }

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

      <Tooltip>
        <TooltipTrigger
          render={({ className: ttClassName, onClick: ttOnClick, ...ttProps }: any) => (
            <Button
              variant="ghost"
              onClick={(e) => {
                ttOnClick?.(e)
                handleProjectClick()
              }}
              className={cn('ml-4 gap-2 h-9 px-3 hover:bg-accent max-w-[240px]', ttClassName)}
              {...ttProps}
            >
              <HugeiconsIcon icon={FolderIcon} className="text-primary shrink-0" />
              {selectedProject ? (
                <>
                  <span className="font-medium text-sm truncate">
                    {selectedProject.name}
                  </span>
                  <HugeiconsIcon icon={ExchangeIcon} className="size-4 text-muted-foreground shrink-0" />
                </>
              ) : (
                <span className="text-sm text-muted-foreground">无项目，点击选择</span>
              )}
            </Button>
          )}
        />
        <TooltipContent>
          {selectedProject ? (
            <p>{selectedProject.name} · 点击切换项目</p>
          ) : (
            <p>暂未选择项目，点击前往项目列表选择</p>
          )}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={({ className: ttClassName, onClick: ttOnClick, disabled: _ttDisabled, ...ttProps }: any) => {
            const disabled = !selectedProject
            return (
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={(e) => {
                  if (disabled) return
                  ttOnClick?.(e)
                  handleEpisodeClick()
                }}
                className={cn(
                  'gap-2 h-9 px-3 hover:bg-accent max-w-[240px]',
                  disabled && 'opacity-50 cursor-not-allowed',
                  ttClassName
                )}
                {...ttProps}
              >
                <HugeiconsIcon icon={Book02Icon} className="text-primary shrink-0" />
                {selectedProject && selectedEpisode ? (
                  <>
                    <span className="font-medium text-sm truncate">
                      {selectedEpisode.title || `第 ${selectedEpisode.level + 1} 集`}
                    </span>
                    <HugeiconsIcon icon={ExchangeIcon} className="size-4 text-muted-foreground shrink-0" />
                  </>
                ) : selectedProject ? (
                  <span className="text-sm text-muted-foreground">无集数，点击选择</span>
                ) : (
                  <span className="text-sm text-muted-foreground">请先选择项目</span>
                )}
              </Button>
            )
          }}
        />
        <TooltipContent>
          {selectedProject && selectedEpisode ? (
            <p>{selectedEpisode.title || `第 ${selectedEpisode.level + 1} 集`} · 点击切换集数</p>
          ) : selectedProject ? (
            <p>暂未选择集数，点击前往剧本管理选择</p>
          ) : (
            <p>请先选择一个项目，再选择对应集数</p>
          )}
        </TooltipContent>
      </Tooltip>

      {showNav && items.length > 0 && (
        <div className="ml-2 hidden lg:block">
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
