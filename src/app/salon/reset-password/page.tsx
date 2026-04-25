import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getCurrentArea, getCurrentTenantOrNotFound, type TenantContext } from '@/lib/tenant/context'
import { ResetPasswordForm } from './reset-password-form'

type SearchParams = Promise<{ code?: string }>

export default async function SalonResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()
  const params = await searchParams
  const code = params.code

  if (!code) {
    return <ResetShell tenant={tenant} body={<InvalidLinkMessage reason="missing" />} />
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return <ResetShell tenant={tenant} body={<InvalidLinkMessage reason="expired" />} />
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
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
              <div>
                <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                  Redefinir senha
                </p>
              </div>
            </div>

            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Nova senha
                  <span className="text-brand-accent">.</span>
                </h2>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">{body}</div>
            </Card>
          </div>
        </div>

        <footer className="relative z-10 flex justify-center px-6 pt-10 pb-8">
          <AraLabsAttribution />
        </footer>
      </main>
    </>
  )
}

function InvalidLinkMessage({ reason }: { reason: 'missing' | 'expired' }) {
  const title = reason === 'expired' ? 'Link expirado ou já usado' : 'Link inválido'
  const description =
    reason === 'expired'
      ? 'Esse link de recuperação não é mais válido. Solicite um novo email.'
      : 'O link parece estar incompleto. Solicite um novo email.'

  return (
    <div className="space-y-3">
      <Alert variant="warning" title={title}>
        {description}
      </Alert>
      <Link
        href="/salon/forgot-password"
        className={buttonVariants({ size: 'lg', fullWidth: true })}
      >
        Solicitar novo email
      </Link>
    </div>
  )
}
