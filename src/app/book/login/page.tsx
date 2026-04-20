import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StepIndicator } from '@/components/book/step-indicator'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'
import { bookHrefWith, parseBookParams } from '@/lib/booking/params'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookStepLogin({ searchParams }: PageProps) {
  const sp = await searchParams
  const current = parseBookParams(sp)

  const hasWizardParams = Boolean(
    current.serviceId && current.date && current.time && current.professionalId,
  )
  const nextHref = hasWizardParams
    ? bookHrefWith('/book/confirmar', current)
    : '/meus-agendamentos'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(nextHref)

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
