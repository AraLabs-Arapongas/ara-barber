import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getActiveServicesForTenant } from '@/lib/booking/queries'
import { StepIndicator } from '@/components/book/step-indicator'
import { BookServiceList } from '@/components/book/service-list'
import { parseBookParams } from '@/lib/booking/params'

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
          Este estabelecimento ainda não cadastrou serviços.
        </div>
      ) : (
        <BookServiceList services={services} current={current} />
      )}
    </main>
  )
}
