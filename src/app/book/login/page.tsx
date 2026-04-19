'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, Mail } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'
import {
  sendCustomerOtp,
  signInCustomerGoogle,
  verifyCustomerOtp,
} from '@/lib/auth/customer-client'

type Stage = 'email' | 'code'

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

  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasWizardParams = Boolean(
    current.serviceId && current.date && current.time && current.professionalId,
  )
  const nextHref = hasWizardParams
    ? bookHrefWith('/book/confirmar', current)
    : '/meus-agendamentos'

  // Se o cliente já está logado, pula pro próximo passo.
  useEffect(() => {
    if (session.email) router.replace(nextHref)
  }, [session.email, nextHref, router])

  async function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Informe um e-mail válido.')
      return
    }
    setPending(true)
    const { error: otpError } = await sendCustomerOtp(value)
    setPending(false)
    if (otpError) {
      setError(otpError)
      return
    }
    setEmail(value)
    setError(null)
    setStage('code')
  }

  async function handleCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const token = code.trim()
    if (token.length < 6) {
      setError('Digite os 6 dígitos recebidos.')
      return
    }
    setPending(true)
    const { error: verifyError } = await verifyCustomerOtp(email, token)
    setPending(false)
    if (verifyError) {
      setError(verifyError)
      return
    }
    router.push(nextHref)
  }

  async function handleGoogle() {
    console.log('[book/login] handleGoogle: click registrado')
    setPending(true)
    try {
      const { error: googleError } = await signInCustomerGoogle(nextHref)
      console.log('[book/login] handleGoogle: resultado', { error: googleError })
      if (googleError) {
        setError(googleError)
        setPending(false)
      }
    } catch (e) {
      console.error('[book/login] handleGoogle: exceção', e)
      setError(String(e))
      setPending(false)
    }
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

      {stage === 'email' ? (
        <>
          <form onSubmit={handleEmail} className="space-y-3">
            <Input
              aria-label="Seu e-mail"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={pending}
              loadingText="Enviando..."
            >
              Receber código
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[0.75rem] text-fg-subtle">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleGoogle}
            loading={pending}
          >
            Continuar com Google
          </Button>
        </>
      ) : (
        <form onSubmit={handleCode} className="space-y-3">
          <div className="rounded-lg bg-bg-subtle px-4 py-3 text-[0.8125rem] text-fg-muted">
            Enviamos um código pra <strong className="text-fg">{email}</strong>.{' '}
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setCode('')
                setError(null)
              }}
              className="font-medium text-brand-primary hover:underline"
            >
              Trocar e-mail
            </button>
          </div>
          <Input
            aria-label="Código de 6 dígitos"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={pending}
            loadingText="Verificando..."
          >
            Entrar
          </Button>
        </form>
      )}
    </main>
  )
}
