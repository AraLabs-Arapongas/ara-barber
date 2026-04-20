'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Users, Scissors, Menu, type LucideIcon } from 'lucide-react'
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
    href: '/salon/dashboard',
    icon: Home,
    label: 'Início',
    match: (p) => p === '/salon/dashboard',
  },
  {
    href: '/salon/dashboard/agenda',
    icon: Calendar,
    label: 'Agenda',
    match: (p) => p.startsWith('/salon/dashboard/agenda'),
  },
  {
    href: '/salon/dashboard/profissionais',
    icon: Users,
    label: 'Equipe',
    match: (p) => p.startsWith('/salon/dashboard/profissionais'),
  },
  {
    href: '/salon/dashboard/servicos',
    icon: Scissors,
    label: 'Serviços',
    match: (p) => p.startsWith('/salon/dashboard/servicos'),
  },
  {
    href: '/salon/dashboard/mais',
    icon: Menu,
    label: 'Mais',
    match: (p) =>
      p.startsWith('/salon/dashboard/mais') ||
      p.startsWith('/salon/dashboard/clientes') ||
      p.startsWith('/salon/dashboard/configuracoes') ||
      p.startsWith('/salon/dashboard/financeiro') ||
      p.startsWith('/salon/dashboard/relatorios') ||
      p.startsWith('/salon/dashboard/disponibilidade') ||
      p.startsWith('/salon/dashboard/equipe-servicos') ||
      p.startsWith('/salon/dashboard/perfil') ||
      p.startsWith('/salon/dashboard/operacao'),
  },
]

export function BottomTabNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40',
        'border-t border-border bg-surface/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]',
      )}
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5',
                  'transition-colors',
                  active ? 'text-brand-primary' : 'text-fg-subtle hover:text-fg',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[0.6875rem] font-medium tracking-wide">
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
