'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

// Aceita URL absoluta (https://…) OU caminho relativo a partir da raiz (/logos/foo.svg).
// Caminho relativo cobre o convencional `resolveConventionalLogoUrl(slug)` em
// src/lib/tenant/context.ts, que serve assets do public/.
const urlOrPath = z
  .string()
  .max(500)
  .refine(
    (s) => s === '' || /^https?:\/\//.test(s) || /^\/[\w\-./]+$/.test(s),
    'Deve ser uma URL https://… ou caminho relativo /…',
  )

const ProfileInput = z.object({
  name: z.string().min(1, 'Nome é obrigatório.').max(120),
  contact_phone: z.string().max(40).optional().or(z.literal('')),
  whatsapp: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email('E-mail inválido.').max(200).optional().or(z.literal('')),
  address_line1: z.string().max(200).optional().or(z.literal('')),
  address_line2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(40).optional().or(z.literal('')),
  postal_code: z.string().max(20).optional().or(z.literal('')),
})

export type UpdateTenantProfileInput = z.infer<typeof ProfileInput>

export type UpdateTenantProfileResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Atualiza o perfil público do tenant (nome, contato, endereço).
 * Strings vazias viram NULL pra manter consistência com colunas nullable.
 *
 * Restrito a BUSINESS_OWNER (defense in depth — RLS também bloqueia via
 * policy `tenants_owner_update_own_policy`). Checamos linhas afetadas pra
 * detectar silent denial caso a policy seja modificada no futuro.
 */
export async function updateTenantProfile(
  raw: UpdateTenantProfileInput,
): Promise<UpdateTenantProfileResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return {
      ok: false,
      error: 'Apenas o dono do negócio pode editar essas informações.',
    }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = ProfileInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const supabase = await createClient()
  const update = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  )

  const { data, error } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }

  revalidatePath('/admin/dashboard/perfil')
  // Revalida a home pública do tenant (mesmo host, segmento /).
  revalidatePath('/')
  return { ok: true }
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const BrandInput = z.object({
  primary_color: z
    .string()
    .regex(HEX_COLOR, 'Cor primária inválida (use #RRGGBB).')
    .optional()
    .or(z.literal('')),
  secondary_color: z
    .string()
    .regex(HEX_COLOR, 'Cor secundária inválida (use #RRGGBB).')
    .optional()
    .or(z.literal('')),
  accent_color: z
    .string()
    .regex(HEX_COLOR, 'Cor de destaque inválida (use #RRGGBB).')
    .optional()
    .or(z.literal('')),
  logo_url: urlOrPath.optional(),
  favicon_url: urlOrPath.optional(),
  home_headline_top: z.string().max(120).optional().or(z.literal('')),
  home_headline_accent: z.string().max(120).optional().or(z.literal('')),
})

export type UpdateTenantBrandInput = z.infer<typeof BrandInput>

export type UpdateTenantBrandResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Atualiza branding (cores, logo, favicon, headlines) do tenant.
 * Cores vazias viram NULL e a home volta ao tema default.
 *
 * Restrito a BUSINESS_OWNER (defense in depth — RLS também bloqueia via
 * policy `tenants_owner_update_own_policy`). Checamos linhas afetadas pra
 * detectar silent denial caso a policy seja modificada no futuro.
 */
export async function updateTenantBrand(
  raw: UpdateTenantBrandInput,
): Promise<UpdateTenantBrandResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return {
      ok: false,
      error: 'Apenas o dono do negócio pode editar essas informações.',
    }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = BrandInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const supabase = await createClient()
  const update = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  )

  const { data, error } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }

  revalidatePath('/admin/dashboard/marca')
  // Revalida a home pública do tenant (mesmo host, segmento /).
  revalidatePath('/')
  return { ok: true }
}
