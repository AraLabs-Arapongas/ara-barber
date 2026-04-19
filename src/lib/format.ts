/**
 * Formata telefone brasileiro em (DD) DDDD-DDDD (fixo) ou (DD) DDDDD-DDDD (celular).
 * Ignora qualquer não-dígito de entrada, cap em 11 dígitos.
 */
export function formatBrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Retorna só os dígitos do telefone — pra guardar no banco.
 */
export function unformatBrPhone(formatted: string): string {
  return formatted.replace(/\D/g, '')
}
