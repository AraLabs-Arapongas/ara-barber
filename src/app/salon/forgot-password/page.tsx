import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { getCurrentArea, getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ForgotPasswordForm } from './forgot-password-form'

export default async function SalonForgotPasswordPage() {
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()

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
                  Recuperar senha
                </p>
              </div>
            </Link>

            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Esqueci a senha
                  <span className="text-brand-accent">.</span>
                </h2>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-muted">
                  Enviaremos um link pro e-mail cadastrado.
                </p>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                <ForgotPasswordForm />
              </div>
            </Card>

            <div className="mt-6 flex justify-center">
              <Link
                href="/salon/login"
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
