import { NavLink, useLocation } from 'react-router-dom'
import type { ComponentProps } from 'react'
import {
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

export interface SidebarItem {
  label: string
  href?: string
  icon?: React.ComponentType<{ className?: string; 'data-icon'?: string }>
  disabled?: boolean
  children?: SidebarItem[]
  badge?: string | number
}

export interface SidebarSection {
  title?: string
  items: SidebarItem[]
}

export interface SidebarProps {
  className?: string
  sections?: SidebarSection[]
  brand?: {
    name: string
    logo?: React.ComponentType<{ className?: string }>
    href?: string
  }
  footer?: React.ReactNode
}

type NavLinkProps = ComponentProps<typeof NavLink>

function MenuItem({ item }: { item: SidebarItem }) {
  const location = useLocation()
  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    const anyChildActive =
      item.children?.some(
        (c) => c.href && location.pathname.startsWith(c.href)
      ) ?? false

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={anyChildActive}
          tooltip={item.label}
          disabled={item.disabled}
        >
          {Icon && <Icon data-icon="inline-start" />}
          <span>{item.label}</span>
          {item.badge !== undefined && (
            <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
          )}
        </SidebarMenuButton>
        <SidebarMenuSub>
          {item.children?.map((child, idx) => (
            <SubItem key={idx} item={child} />
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    )
  }

  if (!item.href) return null

  const isActive =
    item.href === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.href)

  const renderNavLink = ({ className, ...props }: any) => (
    <NavLink
      to={item.href!}
      end={item.href === '/'}
      className={className as NavLinkProps['className']}
      {...props}
    >
      {Icon && <Icon data-icon="inline-start" />}
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
      )}
    </NavLink>
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={renderNavLink}
        isActive={isActive}
        tooltip={item.label}
        disabled={item.disabled}
      />
    </SidebarMenuItem>
  )
}

function SubItem({ item }: { item: SidebarItem }) {
  const location = useLocation()
  if (!item.href) return null

  const isActive = location.pathname.startsWith(item.href)

  const renderNavLink = ({ className, ...props }: any) => {
    const classes = [className as string | undefined]
    if (item.disabled) classes.push('pointer-events-none opacity-50')
    const mergedClassName = classes.filter(Boolean).join(' ')

    if (item.disabled) {
      return (
        <span
          className={mergedClassName}
          aria-disabled="true"
          {...props}
        >
          <span>{item.label}</span>
        </span>
      )
    }

    return (
      <NavLink
        to={item.href!}
        end={item.href === '/'}
        className={mergedClassName as NavLinkProps['className']}
        {...props}
      >
        <span>{item.label}</span>
      </NavLink>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={renderNavLink} isActive={isActive} />
    </SidebarMenuSubItem>
  )
}

function SidebarFooterToggle() {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  return (
    <SidebarTrigger
      variant="ghost"
      size="icon-sm"
      className="ml-auto"
      render={({ className, onClick, ...props }: any) => (
        <button
          type="button"
          onClick={onClick}
          className={className}
          {...props}
        >
          <HugeiconsIcon
            icon={isCollapsed ? ArrowRightDoubleIcon : ArrowLeftDoubleIcon}
            strokeWidth={2}
          />
          <span className="sr-only">Toggle Sidebar</span>
        </button>
      )}
    />
  )
}

export function LayoutSidebar({
  className,
  sections = [],
  brand,
  footer,
}: SidebarProps) {
  return (
    <Sidebar collapsible="icon" className={className}>
      {brand && (
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1 font-semibold">
            {brand.href ? (
              <NavLink to={brand.href} className="flex items-center gap-2">
                {brand.logo && <brand.logo className="size-6 shrink-0" />}
                <span className="group-data-[collapsible=icon]:hidden">
                  {brand.name}
                </span>
              </NavLink>
            ) : (
              <>
                {brand.logo && <brand.logo className="size-6 shrink-0" />}
                <span className="group-data-[collapsible=icon]:hidden">
                  {brand.name}
                </span>
              </>
            )}
          </div>
          <SidebarSeparator />
        </SidebarHeader>
      )}

      <SidebarContent>
        {sections.map((section, sectionIdx) => (
          <SidebarGroup key={sectionIdx}>
            {section.title && (
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item, itemIdx) => (
                  <MenuItem key={itemIdx} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarSeparator className="mb-2" />
        {footer && (
          <>
            <div className="mb-2 group-data-[collapsible=icon]:hidden">
              {footer}
            </div>
            <SidebarSeparator className="mb-2" />
          </>
        )}
        <div className="flex w-full items-center justify-end">
          <SidebarFooterToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
