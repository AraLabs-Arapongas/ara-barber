'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { PRESET_LABELS, type RangePreset } from '@/lib/reports/range'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

const STATUS_ORDER: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELED',
  'NO_SHOW',
]

export type ReportAppt = {
  status: AppointmentStatus
  service_id: string
  professional_id: string
  service_name_snapshot: string | null
}

export type ReportService = { id: string; name: string }
export type ReportProfessional = {
  id: string
  name: string
  display_name: string | null
}

type Props = {
  appointments: ReportAppt[]
  services: ReportService[]
  professionals: ReportProfessional[]
  currentPreset: RangePreset
}

export function ReportsSummary({ appointments, services, professionals, currentPreset }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const svcNameById = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services])
  const profNameById = useMemo(
    () => new Map(professionals.map((p) => [p.id, p.display_name ?? p.name])),
    [professionals],
  )

  const byStatus = useMemo(() => {
    const m = new Map<AppointmentStatus, number>()
    for (const a of appointments) {
      m.set(a.status, (m.get(a.status) ?? 0) + 1)
    }
    return STATUS_ORDER.map((s) => ({ status: s, count: m.get(s) ?? 0 }))
  }, [appointments])

  const byService = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>()
    for (const a of appointments) {
      const cur = m.get(a.service_id) ?? {
        name: svcNameById.get(a.service_id) ?? a.service_name_snapshot ?? 'Serviço',
        count: 0,
      }
      cur.count++
      m.set(a.service_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count)
  }, [appointments, svcNameById])

  const byProfessional = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>()
    for (const a of appointments) {
      const cur = m.get(a.professional_id) ?? {
        name: profNameById.get(a.professional_id) ?? 'Profissional',
        count: 0,
      }
      cur.count++
      m.set(a.professional_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count)
  }, [appointments, profNameById])

  function setPreset(p: RangePreset) {
    router.push(`${pathname}?preset=${p}`)
  }

  const total = appointments.length

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

      <Section title={`Status — ${total} agendamento${total === 1 ? '' : 's'} no período`}>
        {total === 0 ? (
          <Empty />
        ) : (
          <ul className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3">
            {byStatus.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between gap-2 rounded-lg bg-bg-subtle/50 px-3 py-2"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${STATUS_TONE[row.status]}`}
                >
                  {STATUS_LABELS[row.status]}
                </span>
                <span className="font-display text-[1rem] font-semibold text-fg">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top serviços">
        {byService.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byService.slice(0, 10).map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-2 py-2.5 text-[0.875rem]"
              >
                <span className="truncate font-medium text-fg">{s.name}</span>
                <span className="shrink-0 text-fg-muted">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top profissionais">
        {byProfessional.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byProfessional.slice(0, 10).map((p) => (
              <li
                key={p.name}
                className="flex items-center justify-between gap-2 py-2.5 text-[0.875rem]"
              >
                <span className="truncate font-medium text-fg">{p.name}</span>
                <span className="shrink-0 text-fg-muted">{p.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
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
