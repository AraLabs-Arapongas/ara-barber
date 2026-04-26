import { formatDateTime } from '../format.ts'

export type ConfirmationData = {
  customerName: string
  serviceName: string
  professionalName: string
  startAtISO: string
  tenantName: string
  tenantPrimaryColor: string | null
  tenantLogoUrl: string | null
  tenantPhone: string | null
  appointmentUrl: string
  /**
   * Texto de intro customizável vindo de `tenant_message_templates.body`
   * (placeholders já substituídos). Quando ausente, usa um default.
   */
  introText?: string | null
  /**
   * Subject customizado vindo de `tenant_message_templates.subject`
   * (placeholders já substituídos). Quando ausente, usa o default.
   */
  subjectOverride?: string | null
}

export function renderConfirmationHtml(d: ConfirmationData): string {
  const color = d.tenantPrimaryColor ?? '#17343f'
  const logo = d.tenantLogoUrl
    ? `<img src="${d.tenantLogoUrl}" alt="${escapeHtml(d.tenantName)}" style="max-height:48px;margin-bottom:12px" />`
    : `<div style="font-weight:600;font-size:18px;color:${color};margin-bottom:12px">${escapeHtml(d.tenantName)}</div>`

  const intro = d.introText && d.introText.trim()
    ? d.introText
    : `Olá ${d.customerName}, seu horário está marcado.`

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f1f1f">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 16px">${logo}</td></tr>
    <tr><td style="padding:0 32px 24px">
      <h1 style="margin:0 0 8px;font-size:22px">Reserva confirmada</h1>
      <p style="margin:0 0 16px;color:#555">${escapeHtml(intro)}</p>
      <div style="padding:16px;background:#f5f0e8;border-radius:8px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Quando</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600">${formatDateTime(d.startAtISO)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Serviço</p>
        <p style="margin:0 0 12px">${escapeHtml(d.serviceName)} · com ${escapeHtml(d.professionalName)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Onde</p>
        <p style="margin:0">${escapeHtml(d.tenantName)}${d.tenantPhone ? `<br/>☎ ${escapeHtml(d.tenantPhone)}` : ''}</p>
      </div>
      <a href="${d.appointmentUrl}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Ver minha reserva</a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center">
      Enviado pela plataforma AraLabs em nome de ${escapeHtml(d.tenantName)}.
    </td></tr>
  </table>
</body></html>`
}

export function confirmationSubject(d: ConfirmationData): string {
  if (d.subjectOverride && d.subjectOverride.trim()) {
    return d.subjectOverride
  }
  return `Reserva confirmada — ${formatDateTime(d.startAtISO)}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!))
}
