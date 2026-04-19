'use client'

import { useActionState } from 'react'
import { Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { loginPlatformAdminAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export function PlatformLoginForm() {
  const [state, formAction, pending] = useActionState(loginPlatformAdminAction, INITIAL)

  return (
    <>
      <CardHeader>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-brand-accent-fg/70">
          Painel interno
        </p>
        <h1 className="font-display text-[1.75rem] leading-[1.1] tracking-tight text-fg">
          Administração
          <span
            className="ml-1 italic text-brand-primary"
            style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
          >
            AraLabs
          </span>
        </h1>
        <p className="text-[0.9375rem] text-fg-muted">
          Somente membros da equipe AraLabs devem acessar esta área.
        </p>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-5" id="platform-login-form">
          <Input
            label="E-mail corporativo"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nome@aralabs.com.br"
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
            <Alert variant="error" title="Acesso negado">
              {state.error}
            </Alert>
          ) : null}
        </form>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        <Button
          type="submit"
          form="platform-login-form"
          size="lg"
          fullWidth
          loading={pending}
          loadingText="Autenticando..."
        >
          Entrar na plataforma
        </Button>
        <p className="text-center text-[0.75rem] text-fg-subtle">
          Todas as ações nesta área ficam registradas em auditoria.
        </p>
      </CardFooter>
    </>
  )
}
