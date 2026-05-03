'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Calendar, Users, Tag, Menu, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = {
  href: string
  icon: LucideIcon
  label: string
  /** Lista de prefixos de path que ativam essa tab. */
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  {
    href: '/admin/dashboard',
    icon: Home,
    label: 'Início',
    match: (p) => p === '/admin/dashboard',
  },
  {
    href: '/admin/dashboard/agenda',
    icon: Calendar,
    label: 'Agenda',
    match: (p) => p.startsWith('/admin/dashboard/agenda'),
  },
  {
    href: '/admin/dashboard/profissionais',
    icon: Users,
    label: 'Equipe',
    match: (p) => p.startsWith('/admin/dashboard/profissionais'),
  },
  {
    href: '/admin/dashboard/servicos',
    icon: Tag,
    label: 'Serviços',
    match: (p) => p.startsWith('/admin/dashboard/servicos'),
  },
  {
    href: '/admin/dashboard/mais',
    icon: Menu,
    label: 'Mais',
    match: (p) =>
      p.startsWith('/admin/dashboard/mais') ||
      p.startsWith('/admin/dashboard/clientes') ||
      p.startsWith('/admin/dashboard/configuracoes') ||
      p.startsWith('/admin/dashboard/financeiro') ||
      p.startsWith('/admin/dashboard/relatorios') ||
      p.startsWith('/admin/dashboard/disponibilidade') ||
      p.startsWith('/admin/dashboard/equipe-servicos') ||
      p.startsWith('/admin/dashboard/perfil') ||
      p.startsWith('/admin/dashboard/operacao'),
  },
]

export function BottomTabNav() {
  const pathname = usePathname() ?? ''
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Quando o pathname muda, a navegação concluiu — limpa o estado otimista.
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
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const realActive = tab.match(pathname)
          // Quando o user toca outra tab, ativa o destino imediatamente
          // mesmo antes do Next terminar de carregar — sensação instantânea.
          const optimisticActive = pendingHref === tab.href
          const active = optimisticActive || (!pendingHref && realActive)
          const pending = optimisticActive && !realActive
          const Icon = tab.icon
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                prefetch
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (!tab.match(pathname)) setPendingHref(tab.href)
                }}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2',
                  'transition-colors',
                  active ? 'text-brand-primary' : 'text-fg-subtle hover:text-fg',
                )}
              >
                <Icon
                  className={cn('h-5 w-5 shrink-0', pending && 'animate-pulse')}
                  aria-hidden="true"
                />
                <span className="block w-full truncate text-center text-[0.6875rem] font-medium leading-none tracking-tight">
                  {tab.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
