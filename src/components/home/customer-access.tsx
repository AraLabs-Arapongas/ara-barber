'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'

function firstName(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  const first = trimmed.split(/\s+/)[0]
  if (!first) return null
  return first.charAt(0).toUpperCase() + first.slice(1)
}

type Props = {
  loggedIn: boolean
  displayName: string | null
  email: string | null
}

export function CustomerAccess({ loggedIn, displayName, email }: Props) {
  const [open, setOpen] = useState(false)

  if (loggedIn) {
    const display = firstName(displayName) ?? firstName(email?.split('@')[0] ?? null)

    return (
      <div className="w-full max-w-xs">
        <p className="mb-3 text-center text-[0.9375rem] text-fg-muted">
          Bem-vindo
          {display ? (
            <>
              , <strong className="text-fg">{display}</strong>
            </>
          ) : null}{' '}
          👋
        </p>
        <Link href="/meus-agendamentos" className="block">
          <Button variant="secondary" size="lg" fullWidth>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Minhas reservas
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.9375rem] text-fg-muted"
      >
        Já sou cliente?{' '}
        <span className="font-semibold text-fg underline underline-offset-4 hover:text-brand-primary">
          Entrar
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Entrar"
        description="Pra ver suas reservas e fazer uma nova."
      >
        <CustomerLoginForm />
      </BottomSheet>
    </>
  )
}
