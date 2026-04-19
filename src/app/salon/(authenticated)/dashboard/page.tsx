import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getSessionUser } from '@/lib/auth/session'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default async function DashboardPage() {
  const [tenant, user] = await Promise.all([getCurrentTenantOrNotFound(), getSessionUser()])

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex items-center gap-4">
        <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={56} />
        <div className="min-w-0">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Dashboard
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            {tenant.name}
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-brand-accent-fg/70">
            Bem-vindo
          </p>
          <h2 className="font-display text-[1.5rem] font-semibold tracking-tight text-fg">
            Olá, {user?.profile?.name ?? 'equipe'} 👋
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-[0.9375rem] text-fg-muted">
            O painel operacional será construído nos próximos épicos — agenda, cadastros, equipe,
            clientes e relatórios. Por enquanto, este é o placeholder autenticado que confirma que
            você entrou no tenant certo.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
