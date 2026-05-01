import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type LandingBlockType = Database['public']['Enums']['landing_block_type']

export type LandingBlock = {
  id: string
  blockType: LandingBlockType
  enabled: boolean
  position: number
}

export type LandingProfessional = {
  id: string
  name: string
  displayName: string | null
  photoUrl: string | null
}

export type LandingTestimonial = {
  id: string
  authorName: string
  authorPhotoUrl: string | null
  rating: number
  body: string
  position: number
}

export const DEFAULT_LANDING_BLOCKS: ReadonlyArray<{
  blockType: LandingBlockType
  enabled: boolean
  position: number
}> = [
  { blockType: 'HERO', enabled: true, position: 1 },
  { blockType: 'SERVICES', enabled: true, position: 2 },
  { blockType: 'DIFFERENTIALS', enabled: true, position: 3 },
  { blockType: 'PROFESSIONALS', enabled: false, position: 4 },
  { blockType: 'TESTIMONIALS', enabled: true, position: 5 },
  { blockType: 'CONTACT', enabled: true, position: 6 },
  { blockType: 'FINAL_CTA', enabled: true, position: 7 },
]

export async function getLandingBlocks(tenantId: string): Promise<LandingBlock[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('landing_blocks')
    .select('id, block_type, enabled, position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (!data || data.length === 0) {
    return DEFAULT_LANDING_BLOCKS.map((b, i) => ({
      id: `default-${i}`,
      blockType: b.blockType,
      enabled: b.enabled,
      position: b.position,
    }))
  }
  return data.map((b) => ({
    id: b.id,
    blockType: b.block_type,
    enabled: b.enabled,
    position: b.position,
  }))
}

export async function getLandingProfessionals(tenantId: string): Promise<LandingProfessional[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('professionals')
    .select('id, name, display_name, photo_url')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    photoUrl: p.photo_url,
  }))
}

export async function getLandingTestimonials(tenantId: string): Promise<LandingTestimonial[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('testimonials')
    .select('id, author_name, author_photo_url, rating, body, position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  return (data ?? []).map((t) => ({
    id: t.id,
    authorName: t.author_name,
    authorPhotoUrl: t.author_photo_url,
    rating: t.rating,
    body: t.body,
    position: t.position,
  }))
}
