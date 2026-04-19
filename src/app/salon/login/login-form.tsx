'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { loginStaffAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export function SalonLoginForm() {
  const [state, formAction, pending] = useActionState(loginStaffAction, INITIAL)

  return (
    <form action={formAction} className="space-y-3">
      <Input
        aria-label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@salao.com"
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
        leftIcon={<Lock className="h-4 w-4" />}
      />

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
        className="mt-4"
      >
        Entrar
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="flex flex-col items-center gap-1 pt-2 text-[0.75rem] text-fg-subtle">
        <Link
          href="/salon/forgot-password"
          className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Esqueci a senha
        </Link>
        <span>Sem cadastro? Fale com o dono.</span>
      </div>
    </form>
  )
}
