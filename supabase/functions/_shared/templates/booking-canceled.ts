import { formatDateTime } from '../format.ts'

export type CancelData = {
  customerName: string
  serviceName: string
  professionalName: string
  startAtISO: string
  tenantName: string
  tenantPrimaryColor: string | null
  tenantLogoUrl: string | null
  canceledBy: 'CUSTOMER' | 'STAFF'
  bookAgainUrl: string
  /**
   * Texto de intro customizável vindo de `tenant_message_templates.body`
   * (placeholders já substituídos). Quando ausente, usa default que varia
   * conforme `canceledBy`.
   */
  introText?: string | null
  /**
   * Subject customizado vindo de `tenant_message_templates.subject`
   * (placeholders já substituídos). Quando ausente, usa o default.
   */
  subjectOverride?: string | null
}

export function renderCancelHtml(d: CancelData): string {
  const color = d.tenantPrimaryColor ?? '#17343f'
  const logo = d.tenantLogoUrl
    ? `<img src="${d.tenantLogoUrl}" alt="${escapeHtml(d.tenantName)}" style="max-height:48px;margin-bottom:12px" />`
    : `<div style="font-weight:600;font-size:18px;color:${color};margin-bottom:12px">${escapeHtml(d.tenantName)}</div>`

  const intro = d.introText && d.introText.trim()
    ? d.introText
    : d.canceledBy === 'CUSTOMER'
      ? `Olá ${d.customerName}, recebemos seu cancelamento.`
      : `Olá ${d.customerName}, ${d.tenantName} cancelou sua reserva.`

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f1f1f">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 16px">${logo}</td></tr>
    <tr><td style="padding:0 32px 24px">
      <h1 style="margin:0 0 8px;font-size:22px">Reserva cancelada</h1>
      <p style="margin:0 0 16px;color:#555">${escapeHtml(intro)}</p>
      <div style="padding:16px;background:#f5f0e8;border-radius:8px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Era em</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;text-decoration:line-through">${formatDateTime(d.startAtISO)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Serviço</p>
        <p style="margin:0">${escapeHtml(d.serviceName)} · com ${escapeHtml(d.professionalName)}</p>
      </div>
      <a href="${d.bookAgainUrl}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Agendar novamente</a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center">
      Enviado pela plataforma AraLabs em nome de ${escapeHtml(d.tenantName)}.
    </td></tr>
  </table>
</body></html>`
}

export function cancelSubject(d: CancelData): string {
  if (d.subjectOverride && d.subjectOverride.trim()) {
    return d.subjectOverride
  }
  return `Reserva cancelada — ${formatDateTime(d.startAtISO)}`
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
