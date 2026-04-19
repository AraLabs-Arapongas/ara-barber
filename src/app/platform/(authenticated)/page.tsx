import { ShieldCheck } from 'lucide-react'
import { getSessionUser } from '@/lib/auth/session'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Monogram } from '@/components/brand/logo'

export default async function PlatformHomePage() {
  const user = await getSessionUser()

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex items-center gap-4">
        <Monogram className="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Painel interno
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Administração AraLabs
          </h1>
        </div>
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
