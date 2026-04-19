import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewProfessionalForm } from './_new-professional-form'

type Row = {
  id: string
  name: string
  display_name: string | null
  phone: string | null
  is_active: boolean
}

export default async function ProfessionalsPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('professionals')
    .select('id, name, display_name, phone, is_active')
    .order('name')

  const professionals: Row[] = error ? [] : ((data ?? []) as Row[])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Equipe
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Profissionais
        </h1>
        <p className="mt-2 text-[0.9375rem] text-fg-muted">
          Gerencie quem atende no salão.
        </p>
      </header>

      {professionals.length > 0 ? (
        <ul className="mb-8 space-y-2">
          {professionals.map((p) => (
            <li key={p.id}>
              <Card className="shadow-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {p.display_name || p.name}
                    </p>
                    <p className="truncate text-[0.8125rem] text-fg-muted">
                      {p.phone ?? 'sem telefone'}
                    </p>
                  </div>
                  <span
                    className={
                      p.is_active
                        ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                        : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                    }
                  >
                    {p.is_active ? 'Ativo' : 'Inativo'}
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
              Nenhum profissional cadastrado ainda. Comece adicionando o primeiro abaixo.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[1.25rem]">Novo profissional</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 sm:pb-8">
          <NewProfessionalForm />
        </CardContent>
      </Card>
    </main>
  )
}
