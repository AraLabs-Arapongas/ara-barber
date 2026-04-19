import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { Card, CardContent } from '@/components/ui/card'

type Row = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

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

export default async function CustomersPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, email, is_active, created_at')
    .order('created_at', { ascending: false })

  const customers: Row[] = error ? [] : ((data ?? []) as Row[])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agenda
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Clientes
        </h1>
        <p className="mt-2 text-[0.9375rem] text-fg-muted">
          Todos que já logaram no seu salão. O cadastro é feito pelo próprio cliente via booking.
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
                  {!c.is_active ? (
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
