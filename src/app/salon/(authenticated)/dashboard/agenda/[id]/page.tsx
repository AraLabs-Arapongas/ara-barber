import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Clock, Tag, User } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { AppointmentActions } from '@/components/agenda/appointment-actions'
import { canTransition, type AppointmentStatus } from '@/lib/appointments/status-rules'
import { formatCentsToBrl } from '@/lib/money'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Row = {
  id: string
  tenant_id: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  notes: string | null
  price_cents_snapshot: number | null
  customer_name_snapshot: string | null
  customer: { name: string | null; phone: string | null } | null
  professional: { name: string; display_name: string | null } | null
  service: { name: string; duration_minutes: number; price_cents: number } | null
}

type TransitionStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW'

const CANDIDATE_STATUSES: Array<{
  next: TransitionStatus
  label: string
  variant: 'primary' | 'secondary' | 'destructive'
}> = [
  { next: 'CONFIRMED', label: 'Confirmar', variant: 'primary' },
  { next: 'COMPLETED', label: 'Finalizar', variant: 'primary' },
  { next: 'NO_SHOW', label: 'Não veio', variant: 'destructive' },
  { next: 'CANCELED', label: 'Cancelar', variant: 'destructive' },
]

export default async function AppointmentDetailPage({ params, searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const { id } = await params
  const sp = await searchParams
  const fromDate = typeof sp.from === 'string' ? sp.from : undefined
  const backHref = fromDate
    ? `/salon/dashboard/agenda?date=${fromDate}`
    : '/salon/dashboard/agenda'

  const supabase = await createClient()
  const { data: appt } = await supabase
    .from('appointments')
    .select(
      `id, tenant_id, start_at, end_at, status, notes, price_cents_snapshot, customer_name_snapshot,
       customer:customers(name, phone),
       service:services(name, duration_minutes, price_cents),
       professional:professionals(name, display_name)`,
    )
    .eq('id', id)
    .maybeSingle()

  const row = (appt as unknown as Row | null) ?? null
  if (!row || row.tenant_id !== tenant.id) notFound()

  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', tenant.id)
    .maybeSingle()
  const cancellationWindowHours = tenantRow?.cancellation_window_hours ?? 2

  const ctx = {
    actor: 'staff' as const,
    now: new Date(),
    startAt: new Date(row.start_at),
    endAt: new Date(row.end_at),
    cancellationWindowHours,
  }

  const actions = CANDIDATE_STATUSES.filter(
    (candidate) => canTransition(row.status, candidate.next, ctx).ok,
  )

  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const timeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    hour: '2-digit',
    minute: '2-digit',
  })

  const customerName = row.customer?.name ?? row.customer_name_snapshot ?? 'Cliente'
  const customerPhone = row.customer?.phone ?? null

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Agenda
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agendamento
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {dateTimeFmt.format(new Date(row.start_at))}
        </h1>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[row.status]}`}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </header>

      <Card className="mb-4 shadow-xs">
        <CardContent className="space-y-3 py-4">
          <InfoRow
            icon={<Tag className="h-4 w-4" />}
            label="Serviço"
            value={row.service?.name}
            sub={
              row.service
                ? `${row.service.duration_minutes}min · ${formatCentsToBrl(
                    row.price_cents_snapshot ?? row.service.price_cents,
                  )}`
                : undefined
            }
          />
          <InfoRow
            icon={<User className="h-4 w-4" />}
            label="Profissional"
            value={row.professional?.display_name || row.professional?.name}
          />
          <InfoRow
            icon={<User className="h-4 w-4" />}
            label="Cliente"
            value={customerName}
            sub={customerPhone ?? undefined}
          />
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Horário"
            value={`${timeFmt.format(new Date(row.start_at))} → ${timeFmt.format(new Date(row.end_at))}`}
          />
          {row.notes ? (
            <div className="rounded-lg bg-bg-subtle p-3 text-[0.875rem] text-fg">
              <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                Observações
              </p>
              {row.notes}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Ações
        </h2>
        <AppointmentActions appointmentId={row.id} actions={actions} />
      </section>
    </main>
  )
}

function InfoRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-fg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
          {label}
        </p>
        <p className="truncate font-medium text-fg">{value ?? '—'}</p>
        {sub ? <p className="truncate text-[0.8125rem] text-fg-muted">{sub}</p> : null}
      </div>
    </div>
  )
}
