'use client'

import { useActionState } from 'react'
import { loginStaffAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export default function SalonLoginPage() {
  const [state, formAction, pending] = useActionState(loginStaffAction, INITIAL)

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Entrar no salão</h1>

        <form action={formAction} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
