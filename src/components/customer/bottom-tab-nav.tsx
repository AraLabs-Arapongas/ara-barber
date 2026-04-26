'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarPlus, CalendarCheck, Home, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = {
  href: string
  icon: LucideIcon
  label: string
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  {
    href: '/',
    icon: Home,
    label: 'Início',
    match: (p) => p === '/',
  },
  {
    href: '/book',
    icon: CalendarPlus,
    label: 'Agendar',
    match: (p) => p === '/book' || p.startsWith('/book/'),
  },
  {
    href: '/meus-agendamentos',
    icon: CalendarCheck,
    label: 'Reservas',
    match: (p) => p.startsWith('/meus-agendamentos'),
  },
  {
    href: '/perfil',
    icon: User,
    label: 'Perfil',
    match: (p) => p.startsWith('/perfil'),
  },
]

export function CustomerBottomTabNav() {
  const pathname = usePathname() ?? ''
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    if (pendingHref === null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reage a pathname externo
    setPendingHref(null)
  }, [pathname, pendingHref])

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40',
        'border-t border-border bg-surface/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]',
      )}
      aria-label="Navegação do cliente"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const realActive = tab.match(pathname)
          const optimisticActive = pendingHref === tab.href
          const active = optimisticActive || (!pendingHref && realActive)
          const pending = optimisticActive && !realActive
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (!tab.match(pathname)) setPendingHref(tab.href)
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5',
                  'transition-colors',
                  active ? 'text-brand-primary' : 'text-fg-subtle hover:text-fg',
                )}
              >
                <Icon className={cn('h-5 w-5', pending && 'animate-pulse')} aria-hidden="true" />
                <span className="text-[0.6875rem] font-medium tracking-wide">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
