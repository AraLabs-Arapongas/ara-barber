'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ChevronLeft, TrendingUp, CalendarDays, Users, Star } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'
import { atMidnight } from '@/lib/mock/helpers'

export default function RelatoriosPage() {
  const tenantSlug = useTenantSlug()
  const { data: appointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: customers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )

  const stats = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = atMidnight(new Date(now.getTime() - 30 * 86400000))
    const last30 = appointments.filter((a) => new Date(a.startAt) >= thirtyDaysAgo)
    const completed = last30.filter((a) => a.status === 'COMPLETED')
    const noShow = last30.filter((a) => a.status === 'NO_SHOW')
    const canceled = last30.filter((a) => a.status === 'CANCELED')

    const svcById = new Map(services.map((s) => [s.id, s]))
    const revenue = completed.reduce((sum, a) => sum + (svcById.get(a.serviceId)?.priceCents ?? 0), 0)

    const svcCounts = new Map<string, number>()
    for (const a of completed) {
      svcCounts.set(a.serviceId, (svcCounts.get(a.serviceId) ?? 0) + 1)
    }
    const topServices = [...svcCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ service: svcById.get(id), count }))

    const custCounts = new Map<string, number>()
    for (const a of completed) {
      custCounts.set(a.customerId, (custCounts.get(a.customerId) ?? 0) + 1)
    }
    const custById = new Map(customers.map((c) => [c.id, c]))
    const topCustomers = [...custCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ customer: custById.get(id), count }))

    return {
      totalAppts: last30.length,
      completed: completed.length,
      noShow: noShow.length,
      canceled: canceled.length,
      revenue,
      topServices,
      topCustomers,
    }
  }, [appointments, services, customers])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Relatórios
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">Últimos 30 dias.</p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Receita" value={formatCentsToBrl(stats.revenue)} hint={`${stats.completed} atendimentos`} />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Total agendado" value={String(stats.totalAppts)} hint={`${stats.noShow} não vieram · ${stats.canceled} cancel.`} />
      </div>

      <section className="mb-5">
        <h2 className="mb-2 flex items-center gap-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          <Star className="h-3 w-3" /> Top serviços
        </h2>
        <Card className="shadow-xs">
          {stats.topServices.length > 0 ? (
            <ul className="divide-y divide-border">
              {stats.topServices.map((row, i) => (
                <li key={row.service?.id ?? i} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {row.service?.name ?? '—'}
                    </p>
                    <p className="truncate text-[0.8125rem] text-fg-muted">
                      {row.service ? formatCentsToBrl(row.service.priceCents) : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-primary/10 px-2.5 py-1 text-[0.75rem] font-medium text-brand-primary">
                    {row.count}×
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <CardContent className="py-8 text-center text-[0.875rem] text-fg-muted">
              Sem atendimentos no período.
            </CardContent>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          <Users className="h-3 w-3" /> Clientes mais frequentes
        </h2>
        <Card className="shadow-xs">
          {stats.topCustomers.length > 0 ? (
            <ul className="divide-y divide-border">
              {stats.topCustomers.map((row, i) => (
                <li key={row.customer?.id ?? i} className="flex items-center justify-between px-4 py-3">
                  <p className="truncate font-medium text-fg">
                    {row.customer?.name ?? row.customer?.email ?? '(sem nome)'}
                  </p>
                  <span className="shrink-0 rounded-full bg-bg-subtle px-2.5 py-1 text-[0.75rem] font-medium text-fg-muted">
                    {row.count}×
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <CardContent className="py-8 text-center text-[0.875rem] text-fg-muted">
              Sem clientes recorrentes no período.
            </CardContent>
          )}
        </Card>
      </section>
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
        <p className="font-display text-[1.25rem] font-semibold leading-tight tracking-tight text-fg">
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}
