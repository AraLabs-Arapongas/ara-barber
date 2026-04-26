import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { ProfileForm } from '@/components/dashboard/profile-form'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

export default async function PerfilPage() {
  const tenant = await getCurrentTenantOrNotFound()

  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'name, contact_phone, whatsapp, email, address_line1, address_line2, city, state, postal_code',
    )
    .eq('id', tenant.id)
    .maybeSingle()

  if (!data) notFound()

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/admin/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Meu negócio
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Perfil público
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Essas informações aparecem na sua página pública.
        </p>
      </header>

      <ProfileForm
        initial={{
          name: data.name,
          contact_phone: data.contact_phone ?? '',
          whatsapp: data.whatsapp ?? '',
          email: data.email ?? '',
          address_line1: data.address_line1 ?? '',
          address_line2: data.address_line2 ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          postal_code: data.postal_code ?? '',
        }}
      />
    </main>
  )
}
