export type RangePreset = 'today' | 'week' | 'month'

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
}

/**
 * Calcula o intervalo [from, to] em ISO UTC para um preset relativo,
 * usando o "agora" no fuso horário do tenant.
 *
 * - today: 00:00 → 23:59:59.999 do dia atual no TZ
 * - week: domingo 00:00 → fim do dia de hoje
 * - month: dia 1 00:00 → fim do dia de hoje
 *
 * Implementação simples baseada em offset epoch — adequada pra agregação
 * de dashboards (não precisa de DST exato no boundary minuto a minuto).
 */
export function rangeFromPreset(
  preset: RangePreset,
  timezone: string,
): { from: string; to: string } {
  const nowMs = Date.now()
  // Converte "agora" pro instante percebido no TZ do tenant
  const tzNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone }),
  )

  const startOfDay = new Date(tzNow)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(tzNow)
  endOfDay.setHours(23, 59, 59, 999)

  // Offset (em ms) entre tzNow (parsed em local time do server) e wall clock real
  // — usado pra trazer os boundaries de volta pra UTC.
  const offset = tzNow.getTime() - nowMs

  let from: Date
  if (preset === 'today') {
    from = startOfDay
  } else if (preset === 'week') {
    from = new Date(startOfDay)
    from.setDate(from.getDate() - from.getDay())
  } else {
    from = new Date(startOfDay)
    from.setDate(1)
  }

  return {
    from: new Date(from.getTime() - offset).toISOString(),
    to: new Date(endOfDay.getTime() - offset).toISOString(),
  }
}
