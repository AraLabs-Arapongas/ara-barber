import type { AppointmentStatus } from '@/lib/appointments/status-rules'

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Feito',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não veio',
}

/**
 * Tons (badge bg + text) por status. Mais sólidos pra dar leitura
 * imediata em listas com muitos cards. Em ordem de "intensidade":
 *   - SCHEDULED (âmbar): aguardando ação do staff — chama atenção sem alarmar.
 *   - CONFIRMED (verde): tudo certo, cliente pode confiar.
 *   - COMPLETED (cinza): histórico ok, sem alarme.
 *   - CANCELED (cinza neutro): histórico negativo mas sem peso.
 *   - NO_SHOW (vermelho discreto): histórico negativo com peso (cliente
 *     vê que faltou, útil pra correção de comportamento).
 */
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-warning text-warning-fg',
  CONFIRMED: 'bg-success text-success-fg',
  COMPLETED: 'bg-bg-subtle text-fg-muted',
  CANCELED: 'bg-bg-subtle text-fg-subtle line-through',
  NO_SHOW: 'bg-error/15 text-error',
}

/**
 * "Hoje às 14:30" / "Amanhã às 09:00" / "Qui, 25 abr às 14:30"
 */
export function fullDateTimeLabel(iso: string, tenantTimezone: string): string {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  const timeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${dateFmt} · ${timeFmt}`
}
