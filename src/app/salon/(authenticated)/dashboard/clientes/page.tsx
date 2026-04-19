'use client'

import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'

function displayName(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name
  if (email && email.trim().length > 0) return email
  return '(sem nome)'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export default function CustomersPage() {
  const tenantSlug = useTenantSlug()
  const { data: customers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )

  const sorted = [...customers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Base
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Clientes
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Quem já logou no seu salão. Cadastro é feito pelo próprio cliente no booking.
        </p>
      </header>

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <li key={c.id}>
              <Card className="shadow-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {displayName(c.name, c.email)}
                    </p>
                    <p className="truncate text-[0.8125rem] text-fg-muted">
                      {c.phone ?? 'sem telefone'} · desde {formatDate(c.createdAt)}
                    </p>
                  </div>
                  {!c.isActive ? (
                    <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                      Inativo
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum cliente ainda. Assim que alguém agendar pelo link público, aparece aqui.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
