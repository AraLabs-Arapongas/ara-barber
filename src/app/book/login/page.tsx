'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ChevronLeft, Mail } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'

export default function BookStepLogin() {
  const tenantSlug = useTenantSlug()
  const router = useRouter()
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())

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

  const [stage, setStage] = useState<'email' | 'otp'>(session.email ? 'otp' : 'email')
  const [email, setEmail] = useState(session.email ?? '')
  const [error, setError] = useState<string | null>(null)

  // Se veio com params do wizard, vai pra /book/confirmar. Sem params (login
  // standalone, por ex. vindo de /meus-agendamentos), vai pra /meus-agendamentos.
  const hasWizardParams = Boolean(
    current.serviceId && current.date && current.time && current.professionalId,
  )
  const nextHref = hasWizardParams
    ? bookHrefWith('/book/confirmar', current)
    : '/meus-agendamentos'

  function sendOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Informe um e-mail válido.')
      return
    }
    setEmail(value)
    setError(null)
    setStage('otp')
  }

  function confirmOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim()
    if (code.length < 4) {
      setError('Código tem 6 dígitos.')
      return
    }
    // Auto-link ou cria customer
    let customer = customers.find((c) => c.email?.toLowerCase() === email.toLowerCase())
    if (!customer) {
      const newCust = {
        id: mockId('c'),
        name: null,
        email,
        phone: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setCustomers((prev) => [...prev, newCust])
      customer = newCust
    }
    setSession({ customerId: customer.id, email })
    setError(null)
    router.push(nextHref)
  }

  function loginGoogle() {
    // Mock: usa um email fixo e pula OTP.
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
    router.push(nextHref)
  }

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
          <StepIndicator current={5} total={6} labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']} />
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

      {stage === 'email' ? (
        <>
          <form onSubmit={sendOtp} className="space-y-3">
            <Input
              label="Seu e-mail"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            <Button type="submit" size="lg" fullWidth>
              Receber código
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
          <p className="mt-5 text-center text-[0.75rem] text-fg-subtle">
            Preview: qualquer código de 4+ dígitos é aceito.
          </p>
        </>
      ) : (
        <form onSubmit={confirmOtp} className="space-y-3">
          <div className="rounded-lg bg-bg-subtle px-4 py-3 text-[0.8125rem] text-fg-muted">
            Enviamos um código pra <strong className="text-fg">{email}</strong>.{' '}
            <button
              type="button"
              onClick={() => setStage('email')}
              className="font-medium text-brand-primary hover:underline"
            >
              Trocar e-mail
            </button>
          </div>
          <Input
            label="Código"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            autoFocus
            placeholder="123456"
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" size="lg" fullWidth>
            Confirmar
          </Button>
        </form>
      )}
    </main>
  )
}
