/**
 * Copia texto pra clipboard com fallback pra contextos sem `navigator.clipboard`.
 *
 * `navigator.clipboard.writeText` só funciona em HTTPS, `http://localhost` ou
 * `http://127.0.0.1`. Em dev usando `*.lvh.me` (subdomínio que resolve pra
 * 127.0.0.1 mas não é literalmente "localhost"), a API fica `undefined` —
 * por isso o fallback via `document.execCommand('copy')` ainda é necessário.
 *
 * Retorna true se conseguiu copiar; false caso contrário.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Cai pro fallback abaixo (ex: permissão negada).
    }
  }

  if (typeof document === 'undefined') return false

  // Fallback: textarea temporário + execCommand. Deprecado mas suportado
  // amplamente, e funciona em HTTP non-localhost.
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  document.body.appendChild(ta)
  ta.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(ta)
  }
}
