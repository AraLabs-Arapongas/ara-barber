'use client'

/**
 * Feature flags client-side via localStorage. Substitui no futuro por
 * sistema real (PostHog, GrowthBook, ConfigCat, ou tabela `feature_flags`
 * no banco). Por enquanto serve pra esconder/mostrar features mockadas
 * em dev e piloto sem fazer deploy.
 *
 * Convenção: chave `ara:flag:<nome>`, valor `'1'` (on) ou `'0'` (off).
 * Quando a chave NÃO existe, usa o `defaultValue` passado.
 *
 * Toggle manual no DevTools console:
 *   localStorage.setItem('ara:flag:loyalty-stamps', '0')  // desliga
 *   localStorage.setItem('ara:flag:loyalty-stamps', '1')  // liga
 *   localStorage.removeItem('ara:flag:loyalty-stamps')    // volta default
 */

const PREFIX = 'ara:flag:'

export function isFeatureEnabled(name: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${name}`)
    if (raw === null) return defaultValue
    return raw === '1'
  } catch {
    // SSR ou modo privado — fallback default.
    return defaultValue
  }
}
