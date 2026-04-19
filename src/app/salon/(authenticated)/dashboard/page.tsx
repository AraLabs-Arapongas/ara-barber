'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, Calendar, Wallet, TrendingUp } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Appointment, Professional, Service } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function buildLookup<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

export default function DashboardHome() {
  const tenantSlug = useTenantSlug()
  const { data: appointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: payouts } = useMockStore(
    tenantSlug,
    ENTITY.payouts.key,
    ENTITY.payouts.schema,
    ENTITY.payouts.seed,
  )

  const now = new Date()
  const proById = useMemo(() => buildLookup(professionals), [professionals])
  const svcById = useMemo(() => buildLookup(services), [services])

  const today = appointments.filter((a) => isSameDay(new Date(a.startAt), now))
  const todayActive = today.filter((a) => !['CANCELED', 'NO_SHOW', 'COMPLETED'].includes(a.status))
  const next = todayActive
    .filter((a) => new Date(a.startAt).getTime() >= now.getTime() - 30 * 60000)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0]

  const currentPayout = payouts.find((p) => p.status === 'PENDING')
  const todayRevenueCents = today
    .filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
    .reduce((sum, a) => sum + (svcById.get(a.serviceId)?.priceCents ?? 0), 0)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Hoje
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {now.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h1>
      </header>

      {next ? (
        <Card className="mb-4 overflow-hidden">
          <div className="bg-brand-primary/10 px-5 py-3 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-brand-primary">
            Próximo atendimento
          </div>
          <CardContent className="pt-4 pb-5">
            <p className="text-[0.8125rem] text-fg-muted">{timeLabel(next.startAt)}</p>
            <p className="mt-1 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
              {svcById.get(next.serviceId)?.name ?? 'Serviço'}
            </p>
            <p className="mt-0.5 text-[0.875rem] text-fg-muted">
              com {proById.get(next.professionalId)?.displayName ||
                proById.get(next.professionalId)?.name ||
                'profissional'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Agenda hoje"
          value={String(todayActive.length)}
          hint={`${today.filter((a) => a.status === 'COMPLETED').length} já concluídos`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Previsto"
          value={formatCentsToBrl(todayRevenueCents)}
          hint="somando serviços"
        />
      </div>

      {currentPayout ? (
        <Card className="mt-4 shadow-xs">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg-muted">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Saldo a receber
              </p>
              <p className="font-display text-[1.25rem] font-semibold text-fg">
                {formatCentsToBrl(currentPayout.netCents)}
              </p>
              <p className="text-[0.75rem] text-fg-muted">
                Próximo repasse no fim do ciclo
              </p>
            </div>
            <Link
              href="/salon/dashboard/financeiro"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
            >
              Ver
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <QuickActions />

      <AgendaPreview
        appointments={todayActive.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )}
        proById={proById}
        svcById={svcById}
      />
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="py-4">
        <div className="mb-2 flex items-center gap-2 text-fg-muted">
          {icon}
          <span className="text-[0.75rem] font-medium uppercase tracking-[0.14em]">
            {label}
          </span>
        </div>
        <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const actions = [
    { href: '/salon/dashboard/agenda', label: 'Abrir agenda', icon: Calendar },
    { href: '/salon/dashboard/mais', label: 'Ajustes do salão', icon: ArrowRight },
  ] as const
  return (
    <div className="mt-4 flex gap-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-[0.875rem] font-medium text-fg shadow-xs transition-colors hover:bg-bg-subtle"
        >
          {a.label}
          <a.icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}

function AgendaPreview({
  appointments,
  proById,
  svcById,
}: {
  appointments: Appointment[]
  proById: Map<string, Professional>
  svcById: Map<string, Service>
}) {
  if (appointments.length === 0) return null
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Próximos
        </h2>
        <Link
          href="/salon/dashboard/agenda"
          className="text-[0.75rem] text-fg-muted hover:text-fg"
        >
          Ver agenda
        </Link>
      </div>
      <Card className="shadow-xs">
        <ul className="divide-y divide-border">
          {appointments.slice(0, 5).map((a) => {
            const prof = proById.get(a.professionalId)
            const svc = svcById.get(a.serviceId)
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-bg-subtle">
                  <span className="font-display text-[0.9375rem] font-semibold text-fg">
                    {timeLabel(a.startAt)}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{svc?.name ?? 'Serviço'}</p>
                  <p className="truncate text-[0.8125rem] text-fg-muted">
                    {prof?.displayName || prof?.name || 'profissional'}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}

function StatusBadge({ status }: { status: Appointment['status'] }) {
  const map: Record<Appointment['status'], { label: string; className: string }> = {
    SCHEDULED: {
      label: 'Marcado',
      className: 'bg-bg-subtle text-fg-muted',
    },
    CONFIRMED: {
      label: 'Confirmado',
      className: 'bg-info-bg text-info',
    },
    IN_PROGRESS: {
      label: 'Em andamento',
      className: 'bg-warning-bg text-warning',
    },
    COMPLETED: {
      label: 'Feito',
      className: 'bg-success-bg text-success',
    },
    CANCELED: {
      label: 'Cancelado',
      className: 'bg-bg-subtle text-fg-subtle',
    },
    NO_SHOW: {
      label: 'Não veio',
      className: 'bg-error-bg text-error',
    },
  }
  const s = map[status]
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  )
}
