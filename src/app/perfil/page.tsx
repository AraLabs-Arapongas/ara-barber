import Link from 'next/link'
import { Download, FileText, LogOut, Mail, Shield, User } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { Button } from '@/components/ui/button'
import { DeleteAccountButton } from '@/components/customer/delete-account-button'

export default async function PerfilPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-10 text-center sm:px-6">
        <User className="h-12 w-12 text-fg-subtle" aria-hidden="true" />
        <h1 className="mt-4 font-display text-[1.5rem] font-semibold tracking-tight text-fg">
          Você ainda não entrou
        </h1>
        <p className="mt-2 max-w-sm text-[0.9375rem] text-fg-muted">
          Entre pra ver suas reservas, editar seu perfil e receber atualizações.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <Link href="/book/login">
            <Button size="lg" fullWidth>
              Entrar
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const customer = await getCustomerForTenant(tenant.id)
  const email = customer?.email ?? user.email ?? ''
  const phone = customer?.phone ?? null
  const displayName = customer?.name?.trim() || (email ? email.split('@')[0] : null) || 'Cliente'

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6">
      {/* Header compacto: avatar (inicial), nome, email, telefone se houver.
          Sem botão "Editar perfil" porque ainda não temos UI de edição. */}
      <section className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-primary-fg font-display text-lg font-semibold"
          aria-hidden="true"
        >
          {(displayName.charAt(0) || '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[1.25rem] font-semibold leading-tight tracking-tight text-fg">
            {displayName}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.8125rem] text-fg-muted">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {email}
          </p>
          {phone ? (
            <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">{phone}</p>
          ) : null}
        </div>
      </section>

      {/* Conta — ações que mexem no acesso/identidade. */}
      <Section title="Conta">
        <form action="/auth/logout" method="post">
          <Button type="submit" variant="ghost" size="lg" fullWidth>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </Button>
        </form>
        <DeleteAccountButton />
      </Section>

      {/* Privacidade — direitos LGPD do titular + transparência. */}
      <Section title="Privacidade">
        <a href="/api/perfil/dados" download>
          <Button variant="ghost" size="lg" fullWidth>
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar meus dados
          </Button>
        </a>
        <Link href="/politica-privacidade">
          <Button variant="ghost" size="lg" fullWidth>
            <Shield className="h-4 w-4" aria-hidden="true" />
            Política de privacidade
          </Button>
        </Link>
        <Link href="/termos-uso">
          <Button variant="ghost" size="lg" fullWidth>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Termos de uso
          </Button>
        </Link>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  )
}
