'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'

const BUCKET = 'tenant-assets'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

const ProfessionalIdSchema = z.string().uuid()

export type ProfessionalPhotoResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string }

/**
 * Upload da foto do profissional. Path: `tenants/{tenantId}/professionals/{professionalId}-{ts}.ext`.
 * Valida que o professionalId pertence ao tenant atual antes de
 * gravar — defense in depth contra IDs forjados pelo cliente.
 */
export async function uploadProfessionalPhoto(
  formData: FormData,
): Promise<ProfessionalPhotoResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }
  const tenantId = user.profile.tenantId
  if (!tenantId) return { ok: false, error: 'Sem tenant.' }

  const idRaw = formData.get('professionalId')
  const idParsed = ProfessionalIdSchema.safeParse(idRaw)
  if (!idParsed.success) return { ok: false, error: 'ID de profissional inválido.' }
  const professionalId = idParsed.data

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo não enviado.' }
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'Arquivo grande demais (máx 5 MB).' }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: 'Formato não suportado (use PNG, JPG ou WebP).' }
  }

  const supabase = createSecretClient()

  // Garante que o profissional pertence ao tenant logado antes de
  // qualquer storage write — sem isso, staff de A poderia upar foto
  // pra profissional de B com um id forjado.
  const { data: prof } = await supabase
    .from('professionals')
    .select('id')
    .eq('id', professionalId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!prof) return { ok: false, error: 'Profissional não encontrado neste negócio.' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `tenants/${tenantId}/professionals/${professionalId}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (uploadErr) return { ok: false, error: `Falha no upload: ${uploadErr.message}` }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: updErr } = await supabase
    .from('professionals')
    .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', professionalId)
    .eq('tenant_id', tenantId)
  if (updErr) return { ok: false, error: `Falha ao salvar URL: ${updErr.message}` }

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath(`/admin/dashboard/profissionais/${professionalId}`)
  return { ok: true, url: publicUrl }
}

export async function clearProfessionalPhoto(
  professionalId: string,
): Promise<ProfessionalPhotoResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }
  const tenantId = user.profile.tenantId
  if (!tenantId) return { ok: false, error: 'Sem tenant.' }

  const idParsed = ProfessionalIdSchema.safeParse(professionalId)
  if (!idParsed.success) return { ok: false, error: 'ID inválido.' }

  const supabase = createSecretClient()
  const { error } = await supabase
    .from('professionals')
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath(`/admin/dashboard/profissionais/${idParsed.data}`)
  return { ok: true, url: null }
}
