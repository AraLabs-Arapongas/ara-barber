import Link from 'next/link'
import {
  Building2,
  Link2,
  Palette,
  Clock,
  Settings2,
  CalendarOff,
  Users2,
  TrendingUp,
  BarChart3,
  Mail,
  MessageCircle,
  BellRing,
  UserCog,
  CreditCard,
  Shield,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Item = {
  href: string
  icon: LucideIcon
  label: string
  hint: string
}

const SECTIONS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Meu negócio',
    items: [
      {
        href: '/admin/dashboard/perfil',
        icon: Building2,
        label: 'Perfil público',
        hint: 'Logo, nome, endereço, contato',
      },
      {
        href: '/admin/dashboard/link',
        icon: Link2,
        label: 'Link de agendamento',
        hint: 'Copiar, QR Code, compartilhar',
      },
      {
        href: '/admin/dashboard/marca',
        icon: Palette,
        label: 'Marca e aparência',
        hint: 'Cores, logo, headline',
      },
    ],
  },
  {
    title: 'Agenda',
    items: [
      {
        href: '/admin/dashboard/configuracoes/horarios',
        icon: Clock,
        label: 'Horários de funcionamento',
        hint: 'Quando o negócio abre/fecha',
      },
      {
        href: '/admin/dashboard/regras',
        icon: Settings2,
        label: 'Regras de agendamento',
        hint: 'Antecedência, intervalo, cancelamento',
      },
      {
        href: '/admin/dashboard/bloqueios',
        icon: CalendarOff,
        label: 'Bloqueios, folgas e feriados',
        hint: 'Bloquear dias e horários',
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      {
        href: '/admin/dashboard/clientes',
        icon: Users2,
        label: 'Clientes',
        hint: 'Quem já agendou no seu negócio',
      },
      {
        href: '/admin/dashboard/financeiro',
        icon: TrendingUp,
        label: 'Financeiro',
        hint: 'Previsto, realizado, perdido',
      },
      {
        href: '/admin/dashboard/relatorios',
        icon: BarChart3,
        label: 'Relatórios',
        hint: 'Resumo operacional',
      },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      {
        href: '/admin/dashboard/comunicacao/emails',
        icon: Mail,
        label: 'E-mails automáticos',
        hint: 'Confirmação, cancelamento, lembrete',
      },
      {
        href: '/admin/dashboard/comunicacao/whatsapp',
        icon: MessageCircle,
        label: 'WhatsApp',
        hint: 'Mensagens prontas e link de compartilhar',
      },
      {
        href: '/admin/dashboard/comunicacao/notificacoes',
        icon: BellRing,
        label: 'Notificações da equipe',
        hint: 'Avisos no celular do staff',
      },
    ],
  },
  {
    title: 'Conta',
    items: [
      {
        href: '/admin/dashboard/conta/usuarios',
        icon: UserCog,
        label: 'Usuários e permissões',
        hint: 'Quem acessa o painel',
      },
      {
        href: '/admin/dashboard/conta/plano',
        icon: CreditCard,
        label: 'Plano e cobrança',
        hint: 'Trial, plano e cobranças da AraLabs',
      },
      {
        href: '/admin/dashboard/conta/seguranca',
        icon: Shield,
        label: 'Segurança',
        hint: 'Alterar senha e sessões',
      },
    ],
  },
]

export default function MaisPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Configurações e gestão
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
