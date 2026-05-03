import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { LinkSharePanel } from '@/components/dashboard/link-share-panel'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getTenantBookingUrl, getTenantPublicUrl } from '@/lib/tenant/public-url'
import { createSecretClient } from '@/lib/supabase/secret'

const SHARE_LINK_DEFAULT = 'Oi! Agora você pode agendar comigo direto por aqui: {link}'

export default async function LinkPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const publicUrl = await getTenantBookingUrl(tenant)
  const publicHomeUrl = await getTenantPublicUrl(tenant)

  // Carrega template SHARE_LINK do tenant (fallback pro default).
  const supabase = createSecretClient()
  const { data: shareTpl } = await supabase
    .from('tenant_message_templates')
    .select('body, enabled')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'WHATSAPP')
    .eq('event', 'SHARE_LINK')
    .maybeSingle()
  const shareTemplate =
    shareTpl?.enabled && shareTpl.body ? shareTpl.body : SHARE_LINK_DEFAULT

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
          Link de agendamento
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Compartilhe este link nas suas redes, WhatsApp ou cartão.
        </p>
      </header>

      <LinkSharePanel
        publicUrl={publicUrl}
        publicHomeUrl={publicHomeUrl}
        tenantSlug={tenant.slug}
        shareTemplate={shareTemplate}
      />
    </main>
  )
}
