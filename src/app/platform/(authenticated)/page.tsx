import { ShieldCheck } from 'lucide-react'
import { getSessionUser } from '@/lib/auth/session'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default async function PlatformHomePage() {
  const user = await getSessionUser()

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <header className="mb-10">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
          Painel interno
        </p>
        <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2.25rem]">
          Administração AraLabs
        </h1>
      </header>

      <Card>
        <CardHeader>
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Sessão autenticada
          </span>
          <h2 className="font-display text-[1.5rem] font-semibold tracking-tight text-fg">
            Olá, {user?.profile?.name ?? 'admin'}.
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-[0.9375rem] text-fg-muted">
            Este é o placeholder do painel administrativo. O Épico 7 vai construir aqui gestão de
            tenants, catálogo de planos, configuração de billing e logs operacionais.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
