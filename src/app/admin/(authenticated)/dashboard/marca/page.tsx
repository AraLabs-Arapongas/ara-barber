import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { BrandEditor } from '@/components/dashboard/brand-editor'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

export default async function MarcaPage() {
  const tenant = await getCurrentTenantOrNotFound()

  // Lê direto da tabela pra evitar o fallback "convencional" de logo
  // (`/logos/<slug>.<ext>`) aplicado pelo getCurrentTenantOrNotFound — esse
  // path só faz sentido pra render, não pra edição.
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'primary_color, secondary_color, accent_color, logo_url, favicon_url, home_headline_top, home_headline_accent',
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
          Marca e aparência
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Personalize cores, logo e mensagens da sua página pública.
        </p>
      </header>

      <BrandEditor
        initial={{
          primary_color: data.primary_color ?? '',
          secondary_color: data.secondary_color ?? '',
          accent_color: data.accent_color ?? '',
          logo_url: data.logo_url ?? '',
          favicon_url: data.favicon_url ?? '',
          home_headline_top: data.home_headline_top ?? '',
          home_headline_accent: data.home_headline_accent ?? '',
        }}
      />
    </main>
  )
}
