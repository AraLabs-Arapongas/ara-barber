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

/**
 * Substitui placeholders {chave} no body por valores. Placeholders sem valor
 * (undefined, null, string vazia) permanecem literais — não viram "undefined"
 * nem string vazia, pra ficar visível ao staff que falta dado.
 *
 * Exemplo:
 *   applyTemplate("Oi {nome}, {servico} às {horario}", { nome: "Ana", servico: "Corte", horario: "14h" })
 *   → "Oi Ana, Corte às 14h"
 */
export function applyTemplate(
  body: string,
  vars: Record<string, string | undefined | null>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key]
    return v == null || v === '' ? match : v
  })
}

/**
 * Conveniência: gera URL `wa.me/<phone>?text=<msg>` aplicando template +
 * percent-encoding (delegado a `buildWhatsappUrl`). Retorna null se o telefone
 * for inválido.
 */
export function buildWhatsappFromTemplate(
  phone: string | null | undefined,
  template: string,
  vars: Record<string, string | undefined | null>,
): string | null {
  const body = applyTemplate(template, vars)
  return buildWhatsappUrl(phone, body)
}
