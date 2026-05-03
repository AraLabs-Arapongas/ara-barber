'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/browser'

const STORAGE_KEY = 'ara-agenda:admin-login:last-email'
const LEGACY_STORAGE_KEY = 'ara-barber:salon-login:last-email'

const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_EMAIL = IS_DEV ? 'dono@dev.test' : ''

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'error'

/**
 * Login do staff por OTP code-only. Email recebe código de 6 dígitos
 * (Supabase pode incluir link no template padrão, mas a UI só pede o
 * código — caminho único, sem ambiguidade nem dependência de redirect
 * URL allowlist do Supabase).
 *
 * Em dev, email é `dono@dev.test` e o código cai no Inbucket em
 * http://127.0.0.1:54324.
 */
export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState(DEV_EMAIL)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        saved = legacy
        window.localStorage.setItem(STORAGE_KEY, legacy)
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(saved)
    }
  }, [])

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)

    const trimmed = email.trim().toLowerCase()
    const supabase = createClient()
    // Sem `emailRedirectTo` — não usamos magic link, só código.
    // shouldCreateUser:false bloqueia signup acidental (user precisa
    // ter sido provisionado pelo platform admin antes).
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }

    window.localStorage.setItem(STORAGE_KEY, trimmed)
    setStatus('sent')
  }

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cleanCode = code.replace(/\D/g, '')
    if (cleanCode.length !== 6) {
      setErrorMsg('O código tem 6 dígitos.')
      return
    }
    setStatus('verifying')
    setErrorMsg(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: cleanCode,
      type: 'email',
    })

    if (error) {
      setStatus('sent')
      setErrorMsg('Código inválido ou expirado. Confira no email ou peça outro.')
      return
    }

    // Sessão criada — força reload pra layout autenticado validar staff role.
    router.replace('/admin/dashboard')
    router.refresh()
  }

  if (status === 'sent' || status === 'verifying') {
    return (
      <div className="space-y-4">
        <p className="text-[0.875rem] leading-relaxed text-fg-muted">
          Enviamos um <span className="font-medium text-fg">código de 6 dígitos</span> pra{' '}
          <span className="font-medium text-fg">{email}</span>. Cole abaixo pra entrar:
        </p>

        <form onSubmit={handleVerify} className="space-y-3">
          <Input
            aria-label="Código de 6 dígitos"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={7} // permite "123 456" com espaço
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            leftIcon={<KeyRound className="h-4 w-4" />}
            className="text-center text-[1.25rem] font-mono tracking-[0.4em]"
          />

          {errorMsg ? (
            <Alert variant="error" title="Erro">
              {errorMsg}
            </Alert>
          ) : null}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={status === 'verifying'}
            loadingText="Entrando..."
          >
            Entrar com código
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="text-center text-[0.75rem] text-fg-subtle">
          Não chegou?{' '}
          <button
            type="button"
            onClick={() => {
              setStatus('idle')
              setCode('')
              setErrorMsg(null)
            }}
            className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Pedir outro
          </button>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleRequest} className="space-y-3">
      <Input
        aria-label="E-mail"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder="voce@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<Mail className="h-4 w-4" />}
      />

      {status === 'error' && errorMsg ? (
        <Alert variant="error" title="Não foi possível enviar">
          {errorMsg}
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={status === 'sending'}
        loadingText="Enviando..."
        className="mt-3"
      >
        Receber código por email
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <p className="pt-2 text-center text-[0.75rem] text-fg-subtle">
        Sem cadastro? Fale com o dono.
      </p>
    </form>
  )
}
