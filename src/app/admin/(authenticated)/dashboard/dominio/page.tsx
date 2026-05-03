import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { CustomDomainManager } from '@/components/dashboard/custom-domain-manager'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getDomainStatus } from '@/lib/vercel/domains'

export default async function DominioPage() {
  const tenant = await getCurrentTenantOrNotFound()

  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenant.id)
    .maybeSingle()

  const currentDomain = data?.custom_domain ?? null

  // Pré-busca status quando há domínio cadastrado pra evitar flash de
  // "carregando" no client. Se Vercel não responder, manager mostra
  // estado "verificando" e tenta de novo no client.
  let initialStatus = null
  if (currentDomain) {
    const result = await getDomainStatus(currentDomain)
    if (result.ok) initialStatus = result.data
  }

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
          Configurações
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Domínio próprio
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Use seu próprio endereço (ex: <span className="font-medium">agendar.seusite.com.br</span>) em vez do
          subdomínio padrão <span className="font-medium">{tenant.subdomain}.aralabs.com.br</span>.
        </p>
      </header>

      <CustomDomainManager initialDomain={currentDomain} initialStatus={initialStatus} />
    </main>
  )
}
