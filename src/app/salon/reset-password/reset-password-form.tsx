'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const INITIAL: ResetPasswordState = {}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL)
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const password = String(fd.get('password') ?? '')
    const confirm = String(fd.get('confirm') ?? '')

    if (password.length < 8) {
      e.preventDefault()
      setClientError('Mínimo 8 caracteres.')
      return
    }
    if (password !== confirm) {
      e.preventDefault()
      setClientError('Senhas não conferem.')
      return
    }
    setClientError(null)
  }

  const error = clientError ?? state.error ?? null

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3">
      <Input
        aria-label="Nova senha"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        leftIcon={<Lock className="h-4 w-4" />}
        onChange={() => clientError && setClientError(null)}
      />

      <Input
        aria-label="Confirmar senha"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repita a senha"
        leftIcon={<Lock className="h-4 w-4" />}
        onChange={() => clientError && setClientError(null)}
      />

      {error ? (
        <Alert variant="error" title="Não foi possível atualizar">
          {error}
        </Alert>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Atualizando..." className="mt-3">
        Definir nova senha
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
