import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'

export type TenantManifest = {
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: 'standalone'
  background_color: string
  theme_color: string
  icons: Array<{
    src: string
    sizes: string
    type: string
    purpose?: string
  }>
  lang: string
  dir: 'ltr'
}

const DEFAULTS = {
  background: '#f6f0e4', // creme Ara Barber
  theme: '#17343f', // petróleo
  icon192: '/icons/default-192.png',
  icon512: '/icons/default-512.png',
}

export async function buildManifestForSlug(slug: string): Promise<TenantManifest | null> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select('slug, name, primary_color, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return null

  const base = process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br'
  const origin = `https://${data.slug}.${base}`
  const themeColor = data.primary_color ?? DEFAULTS.theme

  return {
    name: data.name,
    short_name: data.name.slice(0, 12),
    description: `App de ${data.name}`,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: DEFAULTS.background,
    theme_color: themeColor,
    icons: [
      {
        src: data.logo_url ?? DEFAULTS.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: data.logo_url ?? DEFAULTS.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    lang: 'pt-BR',
    dir: 'ltr',
  }
}
