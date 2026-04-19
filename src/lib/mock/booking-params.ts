/**
 * Utilitários pro wizard de booking — lê/escreve `serviceId`, `professionalId`,
 * `date`, `time` em searchParams.
 */

export const BOOK_KEYS = ['serviceId', 'professionalId', 'date', 'time'] as const
export type BookParamKey = (typeof BOOK_KEYS)[number]
export type BookParams = Partial<Record<BookParamKey, string>>

export function bookHrefWith(path: string, params: BookParams): string {
  const search = new URLSearchParams()
  for (const k of BOOK_KEYS) {
    const v = params[k]
    if (v) search.set(k, v)
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

export function parseBookParams(raw: Record<string, string | string[] | undefined> | URLSearchParams): BookParams {
  const out: BookParams = {}
  const get = (k: string) => {
    if (raw instanceof URLSearchParams) return raw.get(k) ?? undefined
    const v = raw[k]
    return Array.isArray(v) ? v[0] : v
  }
  for (const k of BOOK_KEYS) {
    const v = get(k)
    if (v) out[k] = v
  }
  return out
}
