'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { PRESET_LABELS, type RangePreset } from '@/lib/reports/range'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

export type FinAppt = {
  id: string
  status: AppointmentStatus
  start_at: string
  price_cents_snapshot: number | null
  service_id: string
  professional_id: string
  service_name_snapshot: string | null
  customer_name_snapshot: string | null
}

export type FinService = { id: string; name: string; price_cents: number }
export type FinProfessional = {
  id: string
  name: string
  display_name: string | null
}

type Props = {
  appointments: FinAppt[]
  services: FinService[]
  professionals: FinProfessional[]
  currentPreset: RangePreset
  tenantTimezone: string
}

export function FinancialSummary({
  appointments,
  services,
  professionals,
  currentPreset,
  tenantTimezone,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const priceById = useMemo(() => new Map(services.map((s) => [s.id, s.price_cents])), [services])
  const svcNameById = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services])
  const profNameById = useMemo(
    () => new Map(professionals.map((p) => [p.id, p.display_name ?? p.name])),
    [professionals],
  )

  const totals = useMemo(() => {
    let scheduled = 0
    let completed = 0
    let lost = 0
    let countCompleted = 0
    for (const a of appointments) {
      const cents = a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      if (a.status === 'COMPLETED') {
        completed += cents
        countCompleted++
      } else if (a.status === 'CANCELED' || a.status === 'NO_SHOW') {
        lost += cents
      } else {
        scheduled += cents
      }
    }
    const ticket = countCompleted > 0 ? Math.round(completed / countCompleted) : 0
    return { scheduled, completed, lost, ticket }
  }, [appointments, priceById])

  const byService = useMemo(() => {
    const m = new Map<string, { name: string; count: number; cents: number }>()
    for (const a of appointments) {
      if (a.status !== 'COMPLETED') continue
      const cur = m.get(a.service_id) ?? {
        name: svcNameById.get(a.service_id) ?? a.service_name_snapshot ?? 'Serviço',
        count: 0,
        cents: 0,
      }
      cur.count++
      cur.cents += a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      m.set(a.service_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.cents - a.cents)
  }, [appointments, svcNameById, priceById])

  const byProfessional = useMemo(() => {
    const m = new Map<string, { name: string; count: number; cents: number }>()
    for (const a of appointments) {
      if (a.status !== 'COMPLETED') continue
      const cur = m.get(a.professional_id) ?? {
        name: profNameById.get(a.professional_id) ?? 'Profissional',
        count: 0,
        cents: 0,
      }
      cur.count++
      cur.cents += a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      m.set(a.professional_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.cents - a.cents)
  }, [appointments, profNameById, priceById])

  function setPreset(p: RangePreset) {
    router.push(`${pathname}?preset=${p}`)
  }

  const dtFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(Object.keys(PRESET_LABELS) as RangePreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            aria-pressed={currentPreset === p}
            className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              currentPreset === p
                ? 'bg-brand-primary text-brand-primary-fg'
                : 'bg-bg-subtle text-fg-muted hover:bg-surface-raised hover:text-fg'
            }`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox
          label="Previsto"
          value={formatCentsToBrl(totals.scheduled + totals.completed)}
          hint="Marcados + concluídos"
        />
        <StatBox
          label="Realizado"
          value={formatCentsToBrl(totals.completed)}
          hint="Atendimentos concluídos"
        />
        <StatBox
          label="Perdido"
          value={formatCentsToBrl(totals.lost)}
          hint="Cancelados ou faltaram"
        />
        <StatBox
          label="Ticket médio"
          value={formatCentsToBrl(totals.ticket)}
          hint="Por atendimento concluído"
        />
      </div>

      <Section title="Por serviço">
        {byService.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byService.slice(0, 10).map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-2 py-2.5 text-[0.875rem]"
              >
                <span className="truncate">
                  <span className="font-medium text-fg">{s.name}</span>{' '}
                  <span className="text-fg-muted">· {s.count}</span>
                </span>
                <span className="shrink-0 font-medium text-fg">{formatCentsToBrl(s.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Por profissional">
        {byProfessional.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byProfessional.slice(0, 10).map((p) => (
              <li
                key={p.name}
                className="flex items-center justify-between gap-2 py-2.5 text-[0.875rem]"
              >
                <span className="truncate">
                  <span className="font-medium text-fg">{p.name}</span>{' '}
                  <span className="text-fg-muted">· {p.count}</span>
                </span>
                <span className="shrink-0 font-medium text-fg">{formatCentsToBrl(p.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Movimentos recentes">
        {appointments.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {appointments.slice(0, 20).map((a) => {
              const cents = a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
              const svcName = a.service_name_snapshot ?? svcNameById.get(a.service_id) ?? 'Serviço'
              return (
                <li key={a.id} className="py-2.5">
                  <Link
                    href={`/admin/dashboard/agenda/${a.id}`}
                    className="flex items-start justify-between gap-2 text-[0.875rem] transition-colors hover:text-brand-primary"
                  >
                    <span className="min-w-0">
                      <span className="block">
                        <span className="font-medium text-fg">{svcName}</span>{' '}
                        <span className="text-fg-muted">
                          · {a.customer_name_snapshot ?? 'Cliente'}
                        </span>
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1.5 text-[0.75rem] text-fg-subtle">
                        {dtFmt.format(new Date(a.start_at))}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${STATUS_TONE[a.status]}`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-fg">{formatCentsToBrl(cents)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

function StatBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="px-3 py-3">
        <p className="text-[0.6875rem] uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="font-display text-[1.25rem] font-semibold leading-tight text-fg">{value}</p>
        <p className="mt-0.5 text-[0.6875rem] text-fg-subtle">{hint}</p>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </h2>
      <Card className="shadow-xs">
        <CardContent className="py-2">{children}</CardContent>
      </Card>
    </section>
  )
}

function Empty() {
  return <p className="py-2 text-[0.875rem] text-fg-muted">Sem dados no período.</p>
}
