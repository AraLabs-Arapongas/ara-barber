import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewServiceForm } from './_new-service-form'

type Row = {
  id: string
  name: string
  duration_minutes: number
  price_cents: number
  is_active: boolean
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ServicesPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents, is_active')
    .order('name')

  const services: Row[] = error ? [] : ((data ?? []) as Row[])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Catálogo
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Serviços
        </h1>
        <p className="mt-2 text-[0.9375rem] text-fg-muted">
          O que seu salão oferece, com duração e preço.
        </p>
      </header>

      {services.length > 0 ? (
        <ul className="mb-8 space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <Card className="shadow-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{s.name}</p>
                    <p className="truncate text-[0.8125rem] text-fg-muted">
                      {s.duration_minutes} min · {brl(s.price_cents)}
                    </p>
                  </div>
                  <span
                    className={
                      s.is_active
                        ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                        : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                    }
                  >
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mb-8 shadow-xs">
          <CardContent className="py-8 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum serviço ainda. Cadastre o primeiro abaixo.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[1.25rem]">Novo serviço</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 sm:pb-8">
          <NewServiceForm />
        </CardContent>
      </Card>
    </main>
  )
}
