/**
 * Parseia entrada "10", "10,50", "10.50", "R$ 10,50" em centavos inteiros.
 * Aceita strings vazias (null). Retorna null se inválido.
 */
export function parseBrlToCents(input: string | null | undefined): number | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed * 100)
}

/**
 * Formata centavos em "R$ 10,50" (pt-BR).
 */
export function formatCentsToBrl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Parseia "10", "10,5", "10.5", "10%" em pontos-base (basis points).
 * 50 → 5000. 50,5 → 5050. Limites: 0 a 1000% (0 a 100000 bp).
 */
export function parsePercentToBasisPoints(input: string | null | undefined): number | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed * 100)
}
