import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

/**
 * Export LGPD — devolve em JSON todos os dados do usuário logado neste tenant.
 * Servido como attachment pro browser salvar.
 */
export async function GET() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, tenant_id, name, email, phone, whatsapp, birth_date, notes, consent_given_at, is_active, created_at, updated_at')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: appointments } = customer
    ? await supabase
        .from('appointments')
        .select(
          `id, start_at, end_at, status, notes, price_cents_snapshot, customer_name_snapshot,
           canceled_at, cancel_reason, created_at,
           service:services(name),
           professional:professionals(name, display_name)`,
        )
        .eq('customer_id', customer.id)
        .order('start_at', { ascending: false })
    : { data: [] }

  const payload = {
    exportedAt: new Date().toISOString(),
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    },
    authUser: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
    },
    customer,
    appointments: appointments ?? [],
  }

  const filename = `meus-dados-${tenant.slug}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
