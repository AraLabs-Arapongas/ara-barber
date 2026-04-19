'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { StepIndicator } from '@/components/book/step-indicator'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'

export default function BookStepLogin() {
  const tenantSlug = useTenantSlug()
  const router = useRouter()
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())

  const { data: session } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  const hasWizardParams = Boolean(
    current.serviceId && current.date && current.time && current.professionalId,
  )
  const nextHref = hasWizardParams
    ? bookHrefWith('/book/confirmar', current)
    : '/meus-agendamentos'

  useEffect(() => {
    if (session.email) router.replace(nextHref)
  }, [session.email, nextHref, router])

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      {hasWizardParams ? (
        <>
          <Link
            href={bookHrefWith('/book/horario', current)}
            className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Horário
          </Link>
          <StepIndicator
            current={5}
            total={6}
            labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']}
          />
        </>
      ) : (
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Home
        </Link>
      )}

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Identifique-se
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Pra confirmar a reserva e avisar se algo mudar.
      </p>

      <CustomerLoginForm redirectTo={nextHref} autoFocusEmail />
    </main>
  )
}
