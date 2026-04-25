'use client'

import { useActionState } from 'react'
import { Mail, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { forgotPasswordAction, type ForgotPasswordState } from './actions'

const INITIAL: ForgotPasswordState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, INITIAL)

  if (state.ok) {
    return (
      <Alert variant="success" title="E-mail enviado">
        Se essa conta existe, enviamos um link pra redefinir a senha. Confira sua caixa de entrada (e o spam).
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <Input
        aria-label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@empresa.com"
        leftIcon={<Mail className="h-4 w-4" />}
      />

      {state.error ? (
        <Alert variant="error" title="Não foi possível enviar">
          {state.error}
        </Alert>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Enviando..." className="mt-3">
        Enviar link de recuperação
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
