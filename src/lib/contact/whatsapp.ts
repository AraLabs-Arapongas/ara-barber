/**
 * Extrai apenas os dígitos do telefone e garante o DDI 55 no início.
 * Retorna null quando o telefone está ausente ou tem menos de 10 dígitos
 * (sem DDD — inválido pra BR).
 */
export function toWhatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.startsWith('55') ? digits : `55${digits}`
}

/**
 * Monta link do wa.me. Se `text` vier, vai como mensagem pré-preenchida.
 */
export function buildWhatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = toWhatsappDigits(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/**
 * Link `tel:` pra discagem direta. Mantém apenas dígitos e DDI 55 na frente.
 */
export function buildTelUrl(phone: string | null | undefined): string | null {
  const digits = toWhatsappDigits(phone)
  if (!digits) return null
  return `tel:+${digits}`
}
