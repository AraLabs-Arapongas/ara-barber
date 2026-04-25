import Link from 'next/link'
import {
  Users2,
  Clock,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StaffPushToggle } from '@/components/push/staff-push-toggle'

type Item = {
  href: string
  icon: LucideIcon
  label: string
  hint: string
}

const SECTIONS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Cadastros',
    items: [
      { href: '/admin/dashboard/clientes', icon: Users2, label: 'Clientes', hint: 'Quem já logou no negócio' },
    ],
  },
  {
    title: 'Agenda',
    items: [
      { href: '/admin/dashboard/configuracoes/horarios', icon: Clock, label: 'Horários de funcionamento', hint: 'Quando abre/fecha' },
    ],
  },
]

export default function MaisPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Menu
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Mais
        </h1>
      </header>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {section.title}
            </h2>
            <Card className="shadow-xs">
              <ul className="divide-y divide-border">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-fg">{item.label}</p>
                          <p className="truncate text-[0.8125rem] text-fg-muted">{item.hint}</p>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-fg-subtle"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>
        ))}

        <section>
          <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Avisos
          </h2>
          <Card className="shadow-xs">
            <StaffPushToggle />
          </Card>
        </section>

        <Card className="shadow-xs">
          <CardContent className="p-0">
            <form action="/auth/logout?next=/admin/login" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-error transition-colors hover:bg-error-bg"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error-bg">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-medium">Sair</span>
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
