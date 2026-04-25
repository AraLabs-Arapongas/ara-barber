'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Loader2, Mail } from 'lucide-react'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.57v2.97h3.85c2.26-2.09 3.58-5.17 3.58-8.78z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.85-2.97c-1.07.72-2.44 1.16-4.08 1.16-3.14 0-5.8-2.12-6.75-4.97H1.29v3.12C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.57H1.29C.47 8.2 0 10.04 0 12s.47 3.8 1.29 5.43l3.96-3.12z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.57l3.96 3.12C6.2 6.87 8.86 4.75 12 4.75z"
      />
    </svg>
  )
}
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { OtpInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  sendCustomerOtp,
  signInCustomerGoogle,
  verifyCustomerOtp,
} from '@/lib/auth/customer-client'

export interface CustomerLoginFormProps {
  /** Pra onde o cliente vai após autenticar. Default: /meus-agendamentos */
  redirectTo?: string
  /** Se true, foca o campo de e-mail no mount. */
  autoFocusEmail?: boolean
  className?: string
}

type Stage = 'email' | 'code'

// Comprimento do OTP enviado pelo Supabase. Supabase Cloud envia 8 dígitos por
// padrão no template de magic link / email OTP. Mantém em sync com o template.
const OTP_LENGTH = 8

export function CustomerLoginForm({
  redirectTo = '/meus-agendamentos',
  autoFocusEmail = false,
  className,
}: CustomerLoginFormProps) {
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Informe um e-mail válido.')
      return
    }
    setPendingEmail(true)
    const { error: otpError } = await sendCustomerOtp(value)
    setPendingEmail(false)
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
    if (token.length < OTP_LENGTH) {
      setError(`Digite os ${OTP_LENGTH} dígitos recebidos.`)
      return
    }
    setPendingEmail(true)
    const { error: verifyError } = await verifyCustomerOtp(email, token)
    setPendingEmail(false)
    if (verifyError) {
      setError(verifyError)
      return
    }
    router.push(redirectTo)
  }

  async function handleGoogle() {
    setPendingGoogle(true)
    try {
      const { error: googleError } = await signInCustomerGoogle(redirectTo)
      if (googleError) {
        setError(googleError)
        setPendingGoogle(false)
      }
    } catch (e) {
      setError(String(e))
      setPendingGoogle(false)
    }
  }

  if (stage === 'code') {
    return (
      <form onSubmit={handleCode} className={cn('space-y-3 text-left', className)}>
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
        <OtpInput
          ariaLabel={`Código de ${OTP_LENGTH} dígitos`}
          name="code"
          length={OTP_LENGTH}
          autoFocus
          error={Boolean(error)}
          value={code}
          onChange={setCode}
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={pendingEmail}
          loadingText="Verificando..."
        >
          Entrar
        </Button>
      </form>
    )
  }

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <div className={cn('space-y-3 text-left', className)}>
      <form onSubmit={handleEmail}>
        <Input
          aria-label="Seu e-mail"
          type="email"
          required
          autoFocus={autoFocusEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          leftIcon={<Mail className="h-4 w-4" />}
          rightSlot={
            <button
              type="submit"
              disabled={!emailIsValid || pendingEmail || pendingGoogle}
              aria-label="Enviar código"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'bg-brand-primary text-brand-primary-fg',
                'transition-opacity duration-200',
                'hover:bg-brand-primary-hover',
                'disabled:cursor-not-allowed disabled:opacity-30',
              )}
            >
              {pendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          }
        />
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        onClick={handleGoogle}
        loading={pendingGoogle}
        loadingText="Abrindo Google..."
        disabled={pendingEmail || pendingGoogle}
      >
        <GoogleIcon className="h-4 w-4" />
        Continuar com Google
      </Button>
    </div>
  )
}
