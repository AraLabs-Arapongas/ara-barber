import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getActiveServicesForTenant } from '@/lib/booking/queries'
import { Card } from '@/components/ui/card'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/booking/params'
import { formatCentsToBrl } from '@/lib/money'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookStepService({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const current = parseBookParams(sp)
  const services = await getActiveServicesForTenant(tenant.id)

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <StepIndicator
        current={1}
        total={6}
        labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']}
      />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        O que você quer fazer?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Escolha o serviço pra começar.
      </p>

      {services.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-[0.875rem] text-fg-muted">
          Este salão ainda não cadastrou serviços.
        </div>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => {
            const selected = current.serviceId === s.id
            return (
              <li key={s.id}>
                <Link
                  href={bookHrefWith('/book/profissional', { ...current, serviceId: s.id })}
                  className="block"
                >
                  <Card
                    className={`transition-colors ${
                      selected
                        ? 'border-brand-primary bg-surface-raised shadow-md'
                        : 'shadow-xs hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fg">{s.name}</p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">
                          {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                        </p>
                        {s.description ? (
                          <p className="mt-1 line-clamp-2 text-[0.75rem] text-fg-subtle">
                            {s.description}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-fg-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
