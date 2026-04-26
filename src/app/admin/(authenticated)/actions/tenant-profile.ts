'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

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
 */
export async function updateTenantProfile(
  raw: UpdateTenantProfileInput,
): Promise<UpdateTenantProfileResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
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

  const { error } = await supabase.from('tenants').update(update).eq('id', tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/dashboard/perfil')
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
  logo_url: z.string().url('URL do logo inválida.').max(500).optional().or(z.literal('')),
  favicon_url: z.string().url('URL do favicon inválida.').max(500).optional().or(z.literal('')),
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
 */
export async function updateTenantBrand(
  raw: UpdateTenantBrandInput,
): Promise<UpdateTenantBrandResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
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

  const { error } = await supabase.from('tenants').update(update).eq('id', tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/dashboard/marca')
  revalidatePath('/')
  return { ok: true }
}
