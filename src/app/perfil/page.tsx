'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarCheck, LogOut, Mail, User } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'

export default function PerfilPage() {
  const tenantSlug = useTenantSlug()
  const [loginOpen, setLoginOpen] = useState(false)

  const { data: session } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )
  const { data: customers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )

  const me = customers.find((c) => c.id === session.customerId)
  const displayName = me?.name?.trim() || (session.email ? session.email.split('@')[0] : null)

  if (!session.email) {
    return (
      <>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-10 text-center sm:px-6">
          <User className="h-12 w-12 text-fg-subtle" aria-hidden="true" />
          <h1 className="mt-4 font-display text-[1.5rem] font-semibold tracking-tight text-fg">
            Você ainda não entrou
          </h1>
          <p className="mt-2 max-w-sm text-[0.9375rem] text-fg-muted">
            Entre pra ver seus agendamentos, editar seu perfil e receber atualizações.
          </p>
          <div className="mt-6 w-full max-w-xs">
            <Button size="lg" fullWidth onClick={() => setLoginOpen(true)}>
              Entrar
            </Button>
          </div>
        </main>

        <BottomSheet
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          title="Entrar"
          description="Pra ver seus agendamentos e fazer uma nova reserva."
        >
          <CustomerLoginForm redirectTo="/perfil" />
        </BottomSheet>
      </>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6">
      <section className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-primary-fg font-display text-xl font-semibold"
          aria-hidden="true"
        >
          {(displayName?.charAt(0) ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
            {displayName ?? 'Cliente'}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.8125rem] text-fg-muted">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {session.email}
          </p>
        </div>
      </section>

      <section className="mt-8 space-y-2">
        <Link href="/meus-agendamentos">
          <Button variant="secondary" size="lg" fullWidth>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Meus agendamentos
          </Button>
        </Link>
      </section>

      <form action="/auth/logout" method="post" className="mt-8">
        <Button type="submit" variant="ghost" size="lg" fullWidth>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </Button>
      </form>
    </main>
  )
}
