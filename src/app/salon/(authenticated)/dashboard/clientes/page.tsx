import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

function displayName(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name
  if (email && email.trim().length > 0) return email
  return '(sem nome)'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function CustomersPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select(
      'id, name, email, phone, is_active, created_at, deleted_at, pwa_installed_at, pwa_install_dismissed_at',
    )
    .eq('tenant_id', tenant.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const customers = data ?? []

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

      {customers.length > 0 ? (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id}>
              <Card className="shadow-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {displayName(c.name, c.email)}
                    </p>
                    <p className="truncate text-[0.8125rem] text-fg-muted">
                      {c.phone ?? 'sem telefone'} · desde {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.pwa_installed_at ? (
                      <span className="rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success">
                        📱 Instalado
                      </span>
                    ) : c.pwa_install_dismissed_at ? (
                      <span
                        className="rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle"
                        title={`Dispensou em ${formatDate(c.pwa_install_dismissed_at)}`}
                      >
                        — Dispensou
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                        — Não instalado
                      </span>
                    )}
                    {!c.is_active ? (
                      <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                        Inativo
                      </span>
                    ) : null}
                  </div>
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
