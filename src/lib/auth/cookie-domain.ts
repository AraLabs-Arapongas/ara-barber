/**
 * Resolve o `domain` que devemos setar nos cookies de sessão Supabase
 * pra um dado host. Permite SSO entre subdomínios da plataforma (ex:
 * `tenant-a.aralabs.com.br` e `tenant-b.aralabs.com.br` compartilham
 * sessão), evitando que o cliente precise logar de novo em cada tenant.
 *
 * Retorna `undefined` pra hosts fora da plataforma (custom domains de
 * tenants, localhost cru) — cookie fica host-only, comportamento default.
 *
 * Ler do mesmo env var que o resolve.ts usa pra parsear o host, pra não
 * desincronizar (ambos precisam concordar sobre qual é a base).
 */
const APP_BASE_HOST = (process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br').toLowerCase()
const DEV_BASE_HOST = (process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me').toLowerCase()

export function resolveCookieDomain(host: string | null | undefined): string | undefined {
  if (!host) return undefined
  const clean = host.split(':')[0].toLowerCase()
  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    if (clean === base || clean.endsWith(`.${base}`)) {
      return `.${base}`
    }
  }
  return undefined
}
