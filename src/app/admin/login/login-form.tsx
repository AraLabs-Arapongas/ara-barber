'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { loginStaffAction, type LoginState } from './actions'

const INITIAL: LoginState = {}
const STORAGE_KEY = 'ara-agenda:admin-login:last-email'

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(loginStaffAction, INITIAL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  // Lê e-mail salvo só no client, depois da hidratação. Evita mismatch
  // server vs client (que quebra seleção e gera warning de controlled).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(saved)
    }
  }, [])

  function handleSubmit() {
    // onSubmit dispara antes da action; persiste/remove o e-mail aqui.
    if (typeof window === 'undefined') return
    if (rememberMe && email) {
      window.localStorage.setItem(STORAGE_KEY, email.trim())
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3">
      <Input
        aria-label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<Mail className="h-4 w-4" />}
      />

      <Input
        aria-label="Senha"
        name="password"
        type="password"
        required
        minLength={6}
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<Lock className="h-4 w-4" />}
      />

      <label className="mt-1 flex cursor-pointer items-center gap-2 px-1 text-[0.8125rem] text-fg-muted">
        <input
          type="checkbox"
          name="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 accent-brand-primary"
        />
        Lembrar-me neste aparelho
      </label>

      {state.error ? (
        <Alert variant="error" title="Não foi possível entrar">
          {state.error}
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingText="Entrando..."
        className="mt-3"
      >
        Entrar
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="flex flex-col items-center gap-1 pt-2 text-[0.75rem] text-fg-subtle">
        <Link
          href="/admin/forgot-password"
          className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Esqueci a senha
        </Link>
        <span>Sem cadastro? Fale com o dono.</span>
      </div>
    </form>
  )
}
