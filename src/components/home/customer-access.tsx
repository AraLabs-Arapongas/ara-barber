'use client'

import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Button } from '@/components/ui/button'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'

export function CustomerAccess() {
  const tenantSlug = useTenantSlug()

  const { data: session } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  if (session.email) {
    return (
      <div className="mt-6 w-full max-w-xs">
        <Link href="/meus-agendamentos" className="block">
          <Button variant="secondary" size="lg" fullWidth>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Meus agendamentos
          </Button>
        </Link>
        <p className="mt-2 text-center text-[0.75rem] text-fg-subtle">
          Entrou como <strong className="text-fg-muted">{session.email}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="mt-10 w-full max-w-xs">
      <div className="mb-4 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        Já é cliente?
        <span className="h-px flex-1 bg-border" />
      </div>
      <CustomerLoginForm />
    </div>
  )
}
