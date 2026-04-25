import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  getBusinessHours,
  getProfessionalAvailability,
  getProfessionalsForService,
} from '@/lib/booking/queries'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/booking/params'
import { weekdayInTenantTZ } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Gera YYYY-MM-DD para o "today" no timezone do tenant + offsetDays.
 */
function tenantDateISO(tenantTimezone: string, offsetDays: number): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [y, m, d] = fmt.format(now).split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + offsetDays)
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookStepDate({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const current = parseBookParams(sp)

  if (!current.serviceId || !current.professionalId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">
          Finalize os passos anteriores.{' '}
          <Link href="/book" className="font-medium text-brand-primary hover:underline">
            Voltar
          </Link>
        </p>
      </main>
    )
  }

  const [businessHours, eligiblePros] = await Promise.all([
    getBusinessHours(tenant.id),
    getProfessionalsForService(tenant.id, current.serviceId),
  ])

  const candidateIds =
    current.professionalId === 'any'
      ? eligiblePros.map((p) => p.id)
      : [current.professionalId]

  const availability = await getProfessionalAvailability(tenant.id, candidateIds)

  const businessOpen = new Set(businessHours.filter((h) => h.isOpen).map((h) => h.weekday))
  const profDays = new Set(availability.map((a) => a.weekday))
  const openWeekdays = new Set([...businessOpen].filter((w) => profDays.has(w)))

  const days = Array.from({ length: 14 }, (_, i) => tenantDateISO(tenant.timezone, i))

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/profissional', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Profissional
      </Link>

      <StepIndicator
        current={3}
        total={6}
        labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']}
      />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Quando?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Escolha o dia nos próximos 14 dias.
      </p>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((dateISO) => {
          const weekday = weekdayInTenantTZ(dateISO, tenant.timezone)
          const [, monthStr, dayStr] = dateISO.split('-')
          const dayNum = Number(dayStr)
          const monthShort = new Date(
            Date.UTC(2020, Number(monthStr) - 1, 1),
          ).toLocaleDateString('pt-BR', { month: 'short' })
          const available = openWeekdays.has(weekday)
          const selected = current.date === dateISO
          const content = (
            <div
              className={cn(
                'flex flex-col items-center rounded-lg px-2 py-3 text-center transition-colors',
                available
                  ? selected
                    ? 'bg-brand-primary text-brand-primary-fg shadow-md'
                    : 'bg-surface border border-border text-fg hover:border-border-strong'
                  : 'bg-bg-subtle text-fg-subtle opacity-60',
              )}
            >
              <span className="text-[0.6875rem] font-medium uppercase tracking-wide">
                {WEEK_LABELS[weekday]}
              </span>
              <span className="mt-0.5 font-display text-[1.25rem] font-semibold leading-none tracking-tight">
                {dayNum}
              </span>
              <span className="mt-0.5 text-[0.6875rem]">{monthShort}</span>
            </div>
          )
          return (
            <li key={dateISO}>
              {available ? (
                <Link
                  href={bookHrefWith('/book/horario', { ...current, date: dateISO })}
                  aria-current={selected ? 'true' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <div aria-disabled="true">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
