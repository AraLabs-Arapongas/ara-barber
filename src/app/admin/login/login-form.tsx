'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Mail, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/browser'

const STORAGE_KEY = 'ara-agenda:admin-login:last-email'
const LEGACY_STORAGE_KEY = 'ara-barber:salon-login:last-email'

// Em dev, pré-preenche com email do seed pra acelerar o ciclo (basta
// clicar enviar e abrir o link no Inbucket em http://127.0.0.1:54324).
const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_EMAIL = IS_DEV ? 'dono@dev.test' : ''

type Status = 'idle' | 'sending' | 'sent' | 'error'

/**
 * Login do staff por OTP (magic link). Sem senha — owner recebe link
 * por email no primeiro acesso e em qualquer login subsequente.
 *
 * `shouldCreateUser: false` garante que apenas users já existentes
 * (criados pelo platform admin via `provisionTenant`) recebem link;
 * email desconhecido recebe a mesma resposta de "enviado" (privacy:
 * não vaza se email existe ou não).
 *
 * `emailRedirectTo` usa `window.location.origin` pra preservar o
 * subdomínio do tenant — link enviado de `flor-de-mirra.aralabs.com.br`
 * volta pra `flor-de-mirra.aralabs.com.br/auth/callback`, não vaza pra
 * outro tenant. Validação de role + tenant_id acontece no layout
 * autenticado via `assertStaff`.
 */
export function AdminLoginForm() {
  const [email, setEmail] = useState(DEV_EMAIL)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Lê email salvo no client (one-shot migration de chave legada).
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)

    const trimmed = email.trim().toLowerCase()
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/dashboard`,
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

  if (status === 'sent') {
    return (
      <div className="space-y-3 text-[0.875rem] leading-relaxed text-fg-muted">
        <p>
          Enviamos um link de acesso pra{' '}
          <span className="font-medium text-fg">{email}</span>. Abra o email e clique no link
          pra entrar.
        </p>
        <p className="text-[0.8125rem] text-fg-subtle">
          Não chegou? Olhe na pasta de spam ou{' '}
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            tente outro email
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
        Receber link de acesso
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <p className="pt-2 text-center text-[0.75rem] text-fg-subtle">
        Sem cadastro? Fale com o dono.
      </p>
    </form>
  )
}
