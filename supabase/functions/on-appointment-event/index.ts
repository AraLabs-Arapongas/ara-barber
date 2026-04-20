import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/channels/email.ts'
import { sendPushToUser, sendPushToTenantStaff } from '../_shared/channels/push.ts'
import {
  renderConfirmationHtml,
  confirmationSubject,
  type ConfirmationData,
} from '../_shared/templates/booking-confirmation.ts'
import {
  renderCancelHtml,
  cancelSubject,
  type CancelData,
} from '../_shared/templates/booking-canceled.ts'

type AppointmentRow = {
  id: string
  tenant_id: string
  customer_id: string
  service_id: string
  professional_id: string
  start_at: string
  status: string
  canceled_by: string | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: AppointmentRow | null
  old_record: AppointmentRow | null
  schema: string
}

type EnrichedData = {
  id: string
  tenant_id: string
  start_at: string
  status: string
  canceled_by: string | null
  service: { id: string; name: string } | null
  professional: { id: string; name: string; display_name: string | null } | null
  customer: { id: string; user_id: string | null; name: string | null; email: string | null } | null
  tenant: {
    id: string
    name: string
    slug: string
    primary_color: string | null
    logo_url: string | null
    contact_phone: string | null
    email: string | null
  } | null
}

async function loadEnrichedData(appointmentId: string): Promise<EnrichedData | null> {
  const client = createAdminClient()
  const { data } = await client
    .from('appointments')
    .select(`
      id, tenant_id, start_at, status, canceled_by,
      service:services(id, name),
      professional:professionals(id, name, display_name),
      customer:customers(id, user_id, name, email),
      tenant:tenants(id, name, slug, primary_color, logo_url, contact_phone, email)
    `)
    .eq('id', appointmentId)
    .maybeSingle()
  return (data as unknown as EnrichedData) ?? null
}

function tenantAppointmentUrl(slug: string, appointmentId: string): string {
  const root = Deno.env.get('TENANT_ROOT_DOMAIN') ?? 'aralabs.com.br'
  return `https://${slug}.${root}/meus-agendamentos/${appointmentId}`
}

function tenantBookAgainUrl(slug: string): string {
  const root = Deno.env.get('TENANT_ROOT_DOMAIN') ?? 'aralabs.com.br'
  return `https://${slug}.${root}/book`
}

async function logPush(
  tenantId: string,
  appointmentId: string,
  event: 'confirmation' | 'cancellation',
  recipient: string,
  result: { sent: number; failed: number },
) {
  const client = createAdminClient()
  if (result.sent > 0) {
    await client.from('notification_log').insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      channel: 'push',
      event,
      recipient,
      status: 'sent',
    })
  }
  if (result.failed > 0) {
    await client.from('notification_log').insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      channel: 'push',
      event,
      recipient,
      status: 'failed',
      error_message: `${result.failed} subscriptions failed`,
    })
  }
}

async function handleInsert(row: AppointmentRow) {
  const data = await loadEnrichedData(row.id)
  if (!data || !data.customer || !data.tenant || !data.service || !data.professional) {
    return { skipped: 'missing enrichment' }
  }

  const { customer, tenant, service, professional } = data
  const proLabel = professional.display_name ?? professional.name

  if (customer.email) {
    const confirmData: ConfirmationData = {
      customerName: customer.name ?? 'cliente',
      serviceName: service.name,
      professionalName: proLabel,
      startAtISO: row.start_at,
      tenantName: tenant.name,
      tenantPrimaryColor: tenant.primary_color,
      tenantLogoUrl: tenant.logo_url,
      tenantPhone: tenant.contact_phone,
      appointmentUrl: tenantAppointmentUrl(tenant.slug, row.id),
    }
    await sendEmail({
      to: customer.email,
      subject: confirmationSubject(confirmData),
      html: renderConfirmationHtml(confirmData),
      replyTo: tenant.email,
      tenantId: row.tenant_id,
      appointmentId: row.id,
      event: 'confirmation',
    })
  }

  if (customer.user_id) {
    const result = await sendPushToUser(customer.user_id, {
      title: 'Horário marcado',
      body: `${service.name} · ${proLabel}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `appointment-${row.id}`,
    })
    await logPush(row.tenant_id, row.id, 'confirmation', customer.user_id, result)
  }

  const staffResult = await sendPushToTenantStaff(row.tenant_id, {
    title: 'Novo agendamento',
    body: `${customer.name ?? 'cliente'} — ${service.name}`,
    url: `/salon/dashboard/agenda/${row.id}`,
    tag: `new-booking-${row.id}`,
  })
  await logPush(row.tenant_id, row.id, 'confirmation', 'staff-fanout', staffResult)

  return { ok: true }
}

async function handleStatusChange(oldRow: AppointmentRow, row: AppointmentRow) {
  if (oldRow.status === row.status || row.status !== 'CANCELED') {
    return { skipped: 'not cancel' }
  }

  const data = await loadEnrichedData(row.id)
  if (!data || !data.customer || !data.tenant || !data.service || !data.professional) {
    return { skipped: 'missing enrichment' }
  }

  const { customer, tenant, service, professional } = data
  const proLabel = professional.display_name ?? professional.name

  // Derive canceledBy by comparing canceled_by (user_id) with customer.user_id
  const canceledBy: 'CUSTOMER' | 'STAFF' =
    row.canceled_by && customer.user_id && row.canceled_by === customer.user_id
      ? 'CUSTOMER'
      : 'STAFF'

  if (customer.email) {
    const cancelData: CancelData = {
      customerName: customer.name ?? 'cliente',
      serviceName: service.name,
      professionalName: proLabel,
      startAtISO: row.start_at,
      tenantName: tenant.name,
      tenantPrimaryColor: tenant.primary_color,
      tenantLogoUrl: tenant.logo_url,
      canceledBy,
      bookAgainUrl: tenantBookAgainUrl(tenant.slug),
    }
    await sendEmail({
      to: customer.email,
      subject: cancelSubject(cancelData),
      html: renderCancelHtml(cancelData),
      replyTo: tenant.email,
      tenantId: row.tenant_id,
      appointmentId: row.id,
      event: 'cancellation',
    })
  }

  if (customer.user_id) {
    const result = await sendPushToUser(customer.user_id, {
      title: 'Reserva cancelada',
      body: `${service.name} — ${proLabel}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `cancel-${row.id}`,
    })
    await logPush(row.tenant_id, row.id, 'cancellation', customer.user_id, result)
  }

  const staffResult = await sendPushToTenantStaff(row.tenant_id, {
    title: 'Reserva cancelada',
    body: `${customer.name ?? 'cliente'} — ${service.name}`,
    url: `/salon/dashboard/agenda/${row.id}`,
    tag: `cancel-staff-${row.id}`,
  })
  await logPush(row.tenant_id, row.id, 'cancellation', 'staff-fanout', staffResult)

  return { ok: true }
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload
    if (payload.table !== 'appointments') {
      return new Response(JSON.stringify({ skipped: 'wrong table' }), { status: 200 })
    }

    let result: unknown
    if (payload.type === 'INSERT' && payload.record) {
      result = await handleInsert(payload.record)
    } else if (payload.type === 'UPDATE' && payload.record && payload.old_record) {
      result = await handleStatusChange(payload.old_record, payload.record)
    } else {
      result = { skipped: 'unhandled type' }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('on-appointment-event error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
})
