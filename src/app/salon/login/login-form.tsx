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
    <form action={formAction} className="space-y-5">
      <Input
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@salao.com"
        leftIcon={<Mail className="h-4 w-4" />}
      />

      <Input
        label="Senha"
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

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Entrando...">
        Entrar
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="flex flex-col gap-2 pt-2 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/salon/forgot-password"
          className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Esqueci a senha
        </Link>
        <span className="text-fg-subtle">Sem cadastro? Fale com o dono.</span>
      </div>
    </form>
  )
}
