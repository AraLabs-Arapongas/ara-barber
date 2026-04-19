'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, LogIn } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Button } from '@/components/ui/button'

/**
 * Bloco secundário na home do tenant com atalhos pro cliente: se já logou,
 * mostra "Meus agendamentos"; caso contrário, oferece entrar com e-mail ou Google.
 */
export function CustomerAccess() {
  const tenantSlug = useTenantSlug()
  const router = useRouter()

  const { data: customers, setData: setCustomers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )
  const { data: session, setData: setSession, hydrated } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  // Evita flicker na SSR — só renderiza depois de ler o localStorage.
  if (!hydrated) {
    return <div className="mt-6 h-16" aria-hidden="true" />
  }

  if (session.email) {
    return (
      <div className="mt-6 w-full max-w-xs">
        <Link href="/meus-agendamentos" className="block">
          <Button variant="secondary" size="lg" fullWidth>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Meus agendamentos
          </Button>
        </Link>
        <p className="mt-2 text-center text-[0.75rem] text-fg-subtle">
          Entrou como <strong className="text-fg-muted">{session.email}</strong>
        </p>
      </div>
    )
  }

  function loginGoogle() {
    const fakeEmail = 'voce@gmail.com'
    let customer = customers.find((c) => c.email === fakeEmail)
    if (!customer) {
      const newCust = {
        id: mockId('c'),
        name: 'Você (Google)',
        email: fakeEmail,
        phone: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setCustomers((prev) => [...prev, newCust])
      customer = newCust
    }
    setSession({ customerId: customer.id, email: fakeEmail })
    router.push('/meus-agendamentos')
  }

  return (
    <div className="mt-8 w-full max-w-xs">
      <div className="mb-3 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        Já é cliente?
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        <Link href="/book/login" className="block">
          <Button variant="secondary" size="lg" fullWidth>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Entrar
          </Button>
        </Link>
        <Button type="button" variant="ghost" size="md" fullWidth onClick={loginGoogle}>
          Continuar com Google
        </Button>
      </div>
    </div>
  )
}
