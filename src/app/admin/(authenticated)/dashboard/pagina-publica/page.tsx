import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createSecretClient } from '@/lib/supabase/secret'
import { getLandingBlocks, getLandingTestimonials, type LandingBlock } from '@/lib/landing/queries'
import { LandingPageEditor } from '@/components/dashboard/landing-page-editor'

export default async function PaginaPublicaPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = createSecretClient()

  const { data: tenantRow } = await supabase
    .from('tenants')
    .select(
      'hero_image_url, hero_subheadline, instagram_url, facebook_url, tiktok_url, differentials',
    )
    .eq('id', tenant.id)
    .maybeSingle()

  const [blocks, testimonials] = await Promise.all([
    getLandingBlocks(tenant.id),
    getLandingTestimonials(tenant.id),
  ])

  // Garante que os 7 blocos default existam mesmo em tenants antigos.
  const fullBlocks = ensureAllBlocks(blocks)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          Página pública
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Configure o que aparece na sua landing — blocos, ordem, conteúdo.
        </p>
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand-primary hover:underline"
        >
          Abrir página pública em nova aba
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </header>

      <LandingPageEditor
        initialBlocks={fullBlocks.map((b) => ({
          blockType: b.blockType,
          enabled: b.enabled,
          position: b.position,
        }))}
        initialHero={{
          subheadline: tenantRow?.hero_subheadline ?? '',
          imageUrl: tenantRow?.hero_image_url ?? null,
        }}
        initialDifferentials={parseInitialDifferentials(tenantRow?.differentials)}
        initialTestimonials={testimonials.map((t) => ({
          id: t.id,
          author_name: t.authorName,
          body: t.body,
          rating: t.rating,
          position: t.position,
        }))}
        initialSocial={{
          instagram_url: tenantRow?.instagram_url ?? '',
          facebook_url: tenantRow?.facebook_url ?? '',
          tiktok_url: tenantRow?.tiktok_url ?? '',
        }}
      />
    </main>
  )
}

function ensureAllBlocks(blocks: LandingBlock[]): LandingBlock[] {
  const types = [
    'HERO',
    'SERVICES',
    'DIFFERENTIALS',
    'PROFESSIONALS',
    'TESTIMONIALS',
    'CONTACT',
    'FINAL_CTA',
  ] as const
  const byType = new Map(blocks.map((b) => [b.blockType, b]))
  let nextPos = blocks.length + 1
  return types.map((t) => {
    const existing = byType.get(t)
    if (existing) return existing
    return {
      id: `placeholder-${t}`,
      blockType: t,
      enabled: t !== 'PROFESSIONALS',
      position: nextPos++,
    }
  })
}

function parseInitialDifferentials(
  raw: unknown,
): Array<{ icon: string; title: string; text: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ icon: string; title: string; text: string }> = []
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      out.push({
        icon: typeof o.icon === 'string' ? o.icon : '',
        title: typeof o.title === 'string' ? o.title : '',
        text: typeof o.text === 'string' ? o.text : '',
      })
    }
  }
  return out
}
