import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getAgendaForDay } from '@/lib/appointments/queries'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { Card, CardContent } from '@/components/ui/card'
import { DaySwitcher } from '@/components/agenda/day-switcher'
import { RealtimeAgendaRefresh } from '@/components/agenda/realtime-refresh'
import { StaffPushBanner } from '@/components/push/staff-push-banner'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function validISOOrToday(raw: string | undefined, tenantTimezone: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return todayISO(tenantTimezone)
}

function timeLabel(iso: string, tenantTimezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const rawDate = typeof sp.date === 'string' ? sp.date : undefined
  const dateISO = validISOOrToday(rawDate, tenant.timezone)

  const appointments = await getAgendaForDay(tenant.id, dateISO, tenant.timezone)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Agenda
        </h1>
      </header>

      <StaffPushBanner />
      <DaySwitcher dateISO={dateISO} tenantTimezone={tenant.timezone} />
      <RealtimeAgendaRefresh tenantId={tenant.id} />

      {appointments.length > 0 ? (
        <ul className="space-y-2">
          {appointments.map((a) => {
            const durationMin = Math.round(
              (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000,
            )
            const isCanceled = a.status === 'CANCELED' || a.status === 'NO_SHOW'
            return (
              <li key={a.id}>
                <Link href={`/admin/dashboard/agenda/${a.id}${rawDate ? `?from=${rawDate}` : ''}`}>
                  <Card
                    className={`shadow-xs transition-colors hover:bg-bg-subtle ${
                      isCanceled ? 'opacity-60' : ''
                    }`}
                  >
                    <CardContent className="flex items-center gap-3 py-3">
                      <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-bg-subtle">
                        <span
                          className={`font-display text-[0.9375rem] font-semibold text-fg ${
                            isCanceled ? 'line-through decoration-fg-subtle' : ''
                          }`}
                        >
                          {timeLabel(a.startAt, tenant.timezone)}
                        </span>
                        <span className="text-[0.6875rem] text-fg-muted">
                          {durationMin}min
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-medium text-fg ${
                            isCanceled ? 'line-through decoration-fg-subtle' : ''
                          }`}
                        >
                          {a.serviceName ?? 'Serviço'}
                        </p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">
                          {a.customerName ?? 'Cliente'} ·{' '}
                          {a.professionalName ?? '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[a.status]}`}
                      >
                        {STATUS_LABELS[a.status]}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum agendamento neste dia.
            </p>
            <p className="mt-1 text-[0.8125rem] text-fg-subtle">
              Clientes se agendam pela página pública.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
