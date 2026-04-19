'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { CalendarCheck, Mail } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

/**
 * Bloco secundário na home do tenant com acesso do cliente: se já logou,
 * mostra "Meus agendamentos"; caso contrário, oferece entrar com e-mail
 * ou Google direto na home (sem redirecionar).
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
  const { data: session, setData: setSession } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  function loginAs(targetEmail: string, nameFromProvider?: string) {
    const normalized = targetEmail.trim().toLowerCase()
    let customer = customers.find((c) => c.email?.toLowerCase() === normalized)
    if (!customer) {
      const newCust = {
        id: mockId('c'),
        name: nameFromProvider ?? null,
        email: normalized,
        phone: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setCustomers((prev) => [...prev, newCust])
      customer = newCust
    } else if (nameFromProvider && !customer.name) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer!.id ? { ...c, name: nameFromProvider } : c)),
      )
    }
    setSession({ customerId: customer.id, email: normalized })
    router.push('/meus-agendamentos')
  }

  function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Informe um e-mail válido.')
      return
    }
    setError(null)
    loginAs(value)
  }

  function loginGoogle() {
    loginAs('voce@gmail.com', 'Você (Google)')
  }

  return (
    <div className="mt-10 w-full max-w-xs">
      <div className="mb-4 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        Já é cliente?
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3 text-left">
        <Input
          label="Seu e-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          leftIcon={<Mail className="h-4 w-4" />}
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button type="submit" size="lg" fullWidth>
          Entrar
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[0.75rem] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="secondary" size="lg" fullWidth onClick={loginGoogle}>
        Continuar com Google
      </Button>

      <p className="mt-4 text-center text-[0.75rem] text-fg-subtle">
        Preview: login sem OTP, qualquer e-mail válido é aceito.
      </p>
    </div>
  )
}
