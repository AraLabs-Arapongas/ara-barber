'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

const BUCKET = 'tenant-assets'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
])

const KindSchema = z.enum(['logo', 'favicon'])
type Kind = z.infer<typeof KindSchema>

const COLUMN_BY_KIND: Record<Kind, 'logo_url' | 'favicon_url'> = {
  logo: 'logo_url',
  favicon: 'favicon_url',
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Faz upload de logo ou favicon do tenant pra Supabase Storage e
 * persiste a URL pública na coluna correspondente em `tenants`.
 *
 * Por que server action com secret client em vez de upload direto
 * client-side via supabase-js:
 *   - Validação de role (BUSINESS_OWNER) acontece aqui, sem precisar
 *     escrever RLS storage por tenant_id (que exigiria parsing de path).
 *   - Cliente não precisa de credenciais de storage; só envia FormData.
 *   - Path é forçado pelo servidor (`tenants/{tenantId}/...`) — cliente
 *     não consegue escrever em outro tenant nem em outro bucket.
 *
 * Path: `tenants/{tenantId}/{kind}-{timestamp}.{ext}`. Timestamp evita
 * cache stale do CDN/browser quando troca a imagem (URL muda).
 *
 * NÃO deletamos imagem anterior — armazenamento é barato e mantém
 * histórico. Cleanup pode entrar como cron depois.
 */
export async function uploadTenantAsset(formData: FormData): Promise<UploadResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: 'Apenas o dono do negócio pode trocar a marca.' }
  }

  const kindRaw = formData.get('kind')
  const kindParsed = KindSchema.safeParse(kindRaw)
  if (!kindParsed.success) return { ok: false, error: 'Tipo inválido (use logo ou favicon).' }
  const kind = kindParsed.data

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo não enviado.' }
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'Arquivo grande demais (máx 5 MB).' }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: 'Formato não suportado (use PNG, JPG, WebP, SVG ou ICO).' }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const ext = extensionFor(file)
  const path = `tenants/${tenant.id}/${kind}-${Date.now()}.${ext}`

  const supabase = createSecretClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false, // path único por timestamp; evita race overwriting
  })
  if (uploadErr) return { ok: false, error: `Falha ao subir: ${uploadErr.message}` }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  // Persiste a URL na coluna correta de tenants.
  const column = COLUMN_BY_KIND[kind]
  const { error: updateErr } = await supabase
    .from('tenants')
    .update({ [column]: url })
    .eq('id', tenant.id)
  if (updateErr) {
    return { ok: false, error: `Upload ok mas falhou ao salvar: ${updateErr.message}` }
  }

  // Revalida tudo que pinta a imagem (home pública, login, marca).
  revalidatePath('/')
  revalidatePath('/admin/dashboard/marca')
  revalidatePath('/admin/login')
  return { ok: true, url }
}

/** Remove a imagem (seta NULL no DB; não apaga do storage). */
export async function clearTenantAsset(kindRaw: string): Promise<UploadResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }
  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: 'Apenas o dono do negócio pode trocar a marca.' }
  }
  const kindParsed = KindSchema.safeParse(kindRaw)
  if (!kindParsed.success) return { ok: false, error: 'Tipo inválido.' }
  const kind = kindParsed.data

  const tenant = await getCurrentTenantOrNotFound()
  const column = COLUMN_BY_KIND[kind]
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({ [column]: null })
    .eq('id', tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/')
  revalidatePath('/admin/dashboard/marca')
  return { ok: true, url: '' }
}

/** Deriva extensão do MIME (file.name pode ser vazio em alguns clients). */
function extensionFor(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    case 'image/x-icon':
      return 'ico'
    default:
      return 'bin'
  }
}
