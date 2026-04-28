import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  searchParams: Promise<{ redirectTo?: string }>
}

/**
 * Login standalone do cliente. Usado por `/meus-agendamentos` e `/perfil`
 * quando o usuário não está autenticado. NÃO faz parte do wizard de
 * booking (`/book`) — wizard hoje faz login inline no step "Confirmar".
 *
 * `redirectTo` (opcional, search param): pra onde mandar após autenticar.
 * Default: `/meus-agendamentos`.
 */
export default async function BookLoginPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sp = await searchParams
  const redirectTo = sp.redirectTo ?? '/meus-agendamentos'
  if (user) redirect(redirectTo)

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-[0.875rem] font-medium text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </Link>

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Entrar
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Use seu e-mail. Vamos enviar um código de 8 dígitos.
      </p>

      <Card>
        <CardContent className="py-5">
          <CustomerLoginForm autoFocusEmail redirectTo={redirectTo} />
        </CardContent>
      </Card>
    </main>
  )
}
