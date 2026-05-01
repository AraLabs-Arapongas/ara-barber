'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { DIFFERENTIAL_ICONS } from '@/components/landing/differentials-block'

const BLOCK_TYPES = [
  'HERO',
  'SERVICES',
  'DIFFERENTIALS',
  'PROFESSIONALS',
  'TESTIMONIALS',
  'CONTACT',
  'FINAL_CTA',
] as const

const BLOCK_BUCKET = 'tenant-assets'
const HERO_MAX_BYTES = 5 * 1024 * 1024
const HERO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

type SimpleResult = { ok: true } | { ok: false; error: string }
type DataResult<T> = { ok: true; data: T } | { ok: false; error: string }

type Guarded =
  | { ok: true; user: Awaited<ReturnType<typeof assertStaff>> }
  | { ok: false; error: string }

async function ensureOwner(): Promise<Guarded> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }
  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: 'Apenas o dono do negócio pode editar a página pública.' }
  }
  return { ok: true, user }
}

// ─── Blocos: toggle + reorder em batch ───────────────────────────────

const BlocksInput = z.object({
  blocks: z
    .array(
      z.object({
        blockType: z.enum(BLOCK_TYPES),
        enabled: z.boolean(),
        position: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(20),
})

export type UpdateLandingBlocksInput = z.infer<typeof BlocksInput>

export async function updateLandingBlocks(raw: UpdateLandingBlocksInput): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = BlocksInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  // Os 7 blocos default já são seedados via migration pra cada tenant
  // (e novos tenants ganham via trigger ou seed). Aqui só atualizamos
  // enabled+position de cada um. Se algum bloco não existir ainda
  // (tenant criado antes da migration), insere.
  const supabaseSecret = createSecretClient()
  for (const b of parsed.data.blocks) {
    const { error: upErr, data: upData } = await supabaseSecret
      .from('landing_blocks')
      .update({ enabled: b.enabled, position: b.position })
      .eq('tenant_id', tenant.id)
      .eq('block_type', b.blockType)
      .select('id')
    if (upErr) return { ok: false, error: upErr.message }
    if (!upData || upData.length === 0) {
      const { error: insErr } = await supabaseSecret.from('landing_blocks').insert({
        tenant_id: tenant.id,
        block_type: b.blockType,
        enabled: b.enabled,
        position: b.position,
      })
      if (insErr) return { ok: false, error: insErr.message }
    }
  }

  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

// ─── Hero: subhead + upload de imagem ────────────────────────────────

const HeroInput = z.object({
  hero_subheadline: z.string().max(280).optional().or(z.literal('')),
})

export type UpdateHeroInput = z.infer<typeof HeroInput>

export async function updateHeroText(raw: UpdateHeroInput): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = HeroInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const supabase = await createClient()
  const { error, data } = await supabase
    .from('tenants')
    .update({
      hero_subheadline: parsed.data.hero_subheadline === '' ? null : parsed.data.hero_subheadline,
    })
    .eq('id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }

  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

export async function uploadHeroImage(formData: FormData): Promise<DataResult<{ url: string }>> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo não enviado.' }
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' }
  if (file.size > HERO_MAX_BYTES) {
    return { ok: false, error: 'Arquivo grande demais (máx 5 MB).' }
  }
  if (!HERO_MIME.has(file.type)) {
    return { ok: false, error: 'Formato não suportado (use PNG, JPG ou WebP).' }
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `tenants/${tenant.id}/hero-${Date.now()}.${ext}`

  const supabase = createSecretClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BLOCK_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { ok: false, error: `Falha ao subir: ${upErr.message}` }

  const { data: pub } = supabase.storage.from(BLOCK_BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  const { error: dbErr } = await supabase
    .from('tenants')
    .update({ hero_image_url: url })
    .eq('id', tenant.id)
  if (dbErr) return { ok: false, error: dbErr.message }

  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true, data: { url } }
}

export async function clearHeroImage(): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({ hero_image_url: null })
    .eq('id', tenant.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

// ─── Diferenciais (até 6 cards) ──────────────────────────────────────

const DifferentialItem = z.object({
  icon: z
    .enum(DIFFERENTIAL_ICONS as [string, ...string[]])
    .optional()
    .or(z.literal('')),
  title: z.string().min(1, 'Título obrigatório.').max(60),
  text: z.string().min(1, 'Texto obrigatório.').max(220),
})

const DifferentialsInput = z.object({
  items: z.array(DifferentialItem).max(6),
})

export type UpdateDifferentialsInput = z.infer<typeof DifferentialsInput>

export async function updateDifferentials(raw: UpdateDifferentialsInput): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = DifferentialsInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const cleaned = parsed.data.items.map((d) => ({
    ...(d.icon ? { icon: d.icon } : {}),
    title: d.title,
    text: d.text,
  }))

  const supabase = await createClient()
  const { error, data } = await supabase
    .from('tenants')
    .update({ differentials: cleaned.length > 0 ? cleaned : null })
    .eq('id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }
  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

// ─── Depoimentos: CRUD ───────────────────────────────────────────────

const TestimonialInput = z.object({
  id: z.string().uuid().optional(),
  author_name: z.string().min(1, 'Nome obrigatório.').max(80),
  body: z.string().min(1, 'Depoimento obrigatório.').max(500),
  rating: z.number().int().min(1).max(5),
  position: z.number().int().min(0).max(999).optional(),
})

export type UpsertTestimonialInput = z.infer<typeof TestimonialInput>

export async function upsertTestimonial(raw: UpsertTestimonialInput): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = TestimonialInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const supabase = await createClient()
  if (parsed.data.id) {
    const { error, data } = await supabase
      .from('testimonials')
      .update({
        author_name: parsed.data.author_name,
        body: parsed.data.body,
        rating: parsed.data.rating,
        position: parsed.data.position ?? 0,
      })
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenant.id)
      .select('id')
    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) {
      return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
    }
  } else {
    const { error } = await supabase.from('testimonials').insert({
      tenant_id: tenant.id,
      author_name: parsed.data.author_name,
      body: parsed.data.body,
      rating: parsed.data.rating,
      position: parsed.data.position ?? 0,
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteTestimonial(id: string): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return { ok: false, error: 'ID inválido.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('testimonials')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}

// ─── Redes sociais ───────────────────────────────────────────────────

const url = z
  .string()
  .max(500)
  .refine((s) => s === '' || /^https?:\/\//.test(s), 'Use uma URL completa (https://...).')

const SocialInput = z.object({
  instagram_url: url.optional(),
  facebook_url: url.optional(),
  tiktok_url: url.optional(),
})

export type UpdateSocialInput = z.infer<typeof SocialInput>

export async function updateSocialLinks(raw: UpdateSocialInput): Promise<SimpleResult> {
  const guard = await ensureOwner()
  if (!guard.ok) return { ok: false, error: guard.error }
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = SocialInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }
  const supabase = await createClient()
  const update = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  )
  const { error, data } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }
  revalidatePath('/admin/dashboard/pagina-publica')
  revalidatePath('/')
  return { ok: true }
}
