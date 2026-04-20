import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Scissors, User, Clock, Calendar } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getProfessionalById, getServiceById } from '@/lib/booking/queries'
import { dateTimeInTenantTZ } from '@/lib/booking/slots'
import { ensureCustomerForTenant } from '@/lib/customers/ensure'
import { Card, CardContent } from '@/components/ui/card'
import { StepIndicator } from '@/components/book/step-indicator'
import { ConfirmForm } from '@/components/book/confirm-form'
import { bookHrefWith, parseBookParams } from '@/lib/booking/params'
import { formatCentsToBrl } from '@/lib/money'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookStepConfirm({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const current = parseBookParams(sp)

  if (
    !current.serviceId ||
    !current.professionalId ||
    current.professionalId === 'any' ||
    !current.date ||
    !current.time
  ) {
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

  const customer = await ensureCustomerForTenant(tenant.id)
  if (!customer) {
    redirect(bookHrefWith('/book/login', current))
  }

  const [svc, prof] = await Promise.all([
    getServiceById(tenant.id, current.serviceId),
    getProfessionalById(tenant.id, current.professionalId),
  ])

  if (!svc || !prof) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">Serviço ou profissional indisponível.</p>
      </main>
    )
  }

  const startAt = dateTimeInTenantTZ(current.date, current.time, tenant.timezone)
  const endAt = new Date(startAt.getTime() + svc.durationMinutes * 60_000)

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(startAt)

  const endLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(endAt)

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/horario', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Horário
      </Link>

      <StepIndicator
        current={6}
        total={6}
        labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']}
      />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Tudo certo?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">Revise e confirme.</p>

      <Card className="mb-4 shadow-xs">
        <CardContent className="space-y-3 py-4">
          <Line
            icon={<Scissors className="h-4 w-4" />}
            label="Serviço"
            value={svc.name}
            sub={`${svc.durationMinutes}min · ${formatCentsToBrl(svc.priceCents)}`}
          />
          <Line
            icon={<User className="h-4 w-4" />}
            label="Profissional"
            value={prof.displayName || prof.name}
          />
          <Line
            icon={<Calendar className="h-4 w-4" />}
            label="Data"
            value={dateLabel}
          />
          <Line
            icon={<Clock className="h-4 w-4" />}
            label="Horário"
            value={`${current.time} → ${endLabel}`}
          />
        </CardContent>
      </Card>

      <ConfirmForm
        initialName={customer!.name ?? ''}
        initialPhone={customer!.phone ?? ''}
        payload={{
          tenantId: tenant.id,
          serviceId: svc.id,
          professionalId: prof.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          priceCentsSnapshot: svc.priceCents,
          customerName: customer!.name ?? '',
          customerPhone: customer!.phone ?? '',
        }}
      />
    </main>
  )
}

function Line({
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
        <p className="truncate font-medium capitalize text-fg">{value ?? '—'}</p>
        {sub ? <p className="truncate text-[0.8125rem] text-fg-muted">{sub}</p> : null}
      </div>
    </div>
  )
}
