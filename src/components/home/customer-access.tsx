'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { CalendarCheck, Mail } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  sendCustomerOtp,
  signInCustomerGoogle,
  verifyCustomerOtp,
} from '@/lib/auth/customer-client'

type Stage = 'email' | 'code'

export function CustomerAccess() {
  const tenantSlug = useTenantSlug()
  const router = useRouter()

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
    // CustomerSessionSync atualiza o mock ao receber SIGNED_IN.
    router.push('/meus-agendamentos')
  }

  async function handleGoogle() {
    console.log('[customer-access] handleGoogle: click registrado')
    setPending(true)
    try {
      const { error: googleError } = await signInCustomerGoogle('/meus-agendamentos')
      console.log('[customer-access] handleGoogle: resultado', { error: googleError })
      if (googleError) {
        setError(googleError)
        setPending(false)
      }
    } catch (e) {
      console.error('[customer-access] handleGoogle: exceção', e)
      setError(String(e))
      setPending(false)
    }
  }

  return (
    <div className="mt-10 w-full max-w-xs">
      <div className="mb-4 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        Já é cliente?
        <span className="h-px flex-1 bg-border" />
      </div>

      {stage === 'email' ? (
        <>
          <form onSubmit={handleEmail} className="space-y-3 text-left">
            <Input
              aria-label="Seu e-mail"
              type="email"
              required
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
        <form onSubmit={handleCode} className="space-y-3 text-left">
          <div className="rounded-lg bg-bg-subtle px-4 py-3 text-[0.8125rem] text-fg-muted">
            Enviamos um código pra{' '}
            <strong className="text-fg">{email}</strong>.{' '}
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
    </div>
  )
}
