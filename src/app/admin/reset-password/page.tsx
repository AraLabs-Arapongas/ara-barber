import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentArea, getCurrentTenantOrNotFound, type TenantContext } from '@/lib/tenant/context'
import { ResetPasswordForm } from './reset-password-form'

export default async function AdminResetPasswordPage() {
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()

  // O code exchange é feito por /auth/callback (route handler que persiste
  // cookies). Quando o user chega aqui via email, callback já setou a session
  // de recovery. Se não houver session, link expirou ou nunca passou.
  const user = await getSessionUser()
  if (!user) {
    return <ResetShell tenant={tenant} body={<InvalidLinkMessage />} />
  }

  return <ResetShell tenant={tenant} body={<ResetPasswordForm />} />
}

function ResetShell({ tenant, body }: { tenant: TenantContext; body: React.ReactNode }) {
  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />

      <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
        <div className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block">
          <BarberStripeOrnament />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <Link
              href="/"
              aria-label={`Página inicial de ${tenant.name}`}
              className="mb-6 flex flex-col items-center gap-3 text-center transition-opacity hover:opacity-80"
            >
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
              <div>
                <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                  Redefinir senha
                </p>
              </div>
            </Link>

            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Nova senha
                  <span className="text-brand-accent">.</span>
                </h2>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">{body}</div>
            </Card>

            <div className="mt-6 flex justify-center">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar pro login
              </Link>
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex justify-center px-6 pt-10 pb-8">
          <AraLabsAttribution />
        </footer>
      </main>
    </>
  )
}

function InvalidLinkMessage() {
  return (
    <div className="space-y-3">
      <Alert variant="warning" title="Link inválido ou expirado">
        Esse link de recuperação não é mais válido. Solicite um novo email.
      </Alert>
      <Link
        href="/admin/forgot-password"
        className={buttonVariants({ size: 'lg', fullWidth: true })}
      >
        Solicitar novo email
      </Link>
    </div>
  )
}
