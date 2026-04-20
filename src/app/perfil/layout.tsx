import type { ReactNode } from 'react'
import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { CustomerShell } from '@/components/customer/customer-shell'

export default async function PerfilLayout({ children }: { children: ReactNode }) {
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
      <div className="min-h-screen bg-bg text-fg">
        <CustomerShell>
          <header className="border-b border-border bg-surface/80 backdrop-blur">
            <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3 sm:px-6">
              <Link
                href="/"
                aria-label="Home do salão"
                className="flex min-w-0 items-center gap-3"
              >
                <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-display text-[1rem] font-semibold leading-tight tracking-tight text-fg">
                    {tenant.name}
                  </p>
                  <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-subtle">
                    Perfil
                  </p>
                </div>
              </Link>
            </div>
          </header>
          {children}
        </CustomerShell>
      </div>
    </>
  )
}
