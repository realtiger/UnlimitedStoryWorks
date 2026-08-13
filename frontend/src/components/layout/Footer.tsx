import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export interface FooterLink {
  label: string
  href: string
  external?: boolean
}

export interface FooterSection {
  title: string
  links: FooterLink[]
}

export interface FooterProps {
  className?: string
  copyright?: string
  links?: FooterLink[]
  sections?: FooterSection[]
  socialLinks?: FooterLink[]
  recordNumber?: string
}

function isExternalUrl(href: string) {
  return /^https?:\/\//i.test(href)
}

export function Footer({
  className,
  copyright = `© ${new Date().getFullYear()} Unlimited Story Works. All rights reserved.`,
  links,
  sections,
  recordNumber,
}: FooterProps) {
  return (
    <footer
      className={cn(
        'border-t border-border bg-background',
        className
      )}
      data-slot="footer"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {(links || (sections && sections.length > 0)) && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {links && links.length > 0
                ? links.map((link, idx) => {
                    const external = link.external ?? isExternalUrl(link.href)
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-4"
                      >
                        {external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <NavLink
                            to={link.href}
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {link.label}
                          </NavLink>
                        )}
                        {idx < links.length - 1 && (
                          <Separator
                            orientation="vertical"
                            className="h-3 bg-border/60"
                          />
                        )}
                      </div>
                    )
                  })
                : sections?.flatMap((s, sIdx) =>
                    s.links.map((link, lIdx) => {
                      const isLast =
                        sIdx === (sections?.length ?? 0) - 1 &&
                        lIdx === s.links.length - 1
                      const external =
                        link.external ?? isExternalUrl(link.href)
                      return (
                        <div
                          key={`${sIdx}-${lIdx}`}
                          className="flex items-center gap-4"
                        >
                          {external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {link.label}
                            </a>
                          ) : (
                            <NavLink
                              to={link.href}
                              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {link.label}
                            </NavLink>
                          )}
                          {!isLast && (
                            <Separator
                              orientation="vertical"
                              className="h-3 bg-border/60"
                            />
                          )}
                        </div>
                      )
                    })
                  )}
            </div>
            <Separator className="my-4" />
          </>
        )}

        <div className="flex flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          {recordNumber && <p>{recordNumber}</p>}
          <div className="flex items-center gap-3">
            <p>{copyright}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
