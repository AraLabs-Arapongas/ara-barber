import 'server-only'

/**
 * Cliente fino pra Vercel REST API — apenas o que precisamos pra
 * gerenciar custom domains de tenants. Sem SDK extra; `fetch` nativo.
 *
 * Env vars necessárias (server-only):
 *   - VERCEL_API_TOKEN       (token com escopo `domains:write`)
 *   - VERCEL_PROJECT_ID      (projeto que recebe os custom domains)
 *   - VERCEL_TEAM_ID         (team owner do projeto)
 *
 * Em ambiente sem essas vars (dev sem token configurado) as funções
 * retornam erro estruturado em vez de throw — chamador decide.
 */

const API_BASE = 'https://api.vercel.com'

type EnvOk = {
  ok: true
  token: string
  projectId: string
  teamId: string
}

type EnvMissing = {
  ok: false
  error: 'VERCEL_ENV_MISSING'
  message: string
}

function readEnv(): EnvOk | EnvMissing {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token || !projectId || !teamId) {
    return {
      ok: false,
      error: 'VERCEL_ENV_MISSING',
      message: 'VERCEL_API_TOKEN, VERCEL_PROJECT_ID e VERCEL_TEAM_ID precisam estar configurados.',
    }
  }
  return { ok: true, token, projectId, teamId }
}

export type DomainResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string }

/**
 * Anexa um domínio ao projeto Vercel. Vercel automaticamente provisiona
 * cert Let's Encrypt assim que DNS validar.
 *
 * Erros comuns:
 *   - `domain_already_in_use` (409): domínio em outro projeto/team
 *   - `forbidden` (403): token sem escopo
 *   - `invalid_domain` (400): formato inválido
 */
export async function addDomainToProject(domain: string): Promise<DomainResult> {
  const env = readEnv()
  if (!env.ok) return env

  const url = `${API_BASE}/v10/projects/${env.projectId}/domains?teamId=${env.teamId}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  })

  if (resp.ok) return { ok: true, data: undefined }

  const body = (await resp.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  return {
    ok: false,
    error: body.error?.code ?? `http_${resp.status}`,
    message: body.error?.message ?? `HTTP ${resp.status}`,
  }
}

/**
 * Remove o domínio do projeto. Idempotente: 404 também conta como ok
 * (já não estava lá).
 */
export async function removeDomainFromProject(domain: string): Promise<DomainResult> {
  const env = readEnv()
  if (!env.ok) return env

  const url = `${API_BASE}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}?teamId=${env.teamId}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.token}` },
  })

  if (resp.ok || resp.status === 404) return { ok: true, data: undefined }

  const body = (await resp.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  return {
    ok: false,
    error: body.error?.code ?? `http_${resp.status}`,
    message: body.error?.message ?? `HTTP ${resp.status}`,
  }
}

export type DomainStatus = {
  /** Domínio responde via Vercel (DNS aponta certo). */
  verified: boolean
  /** Cert provisionado e roteamento válido (pronto pra produção). */
  configurationOk: boolean
  /** Instruções pro user configurar no registrar dele. Presente quando ainda não validou. */
  instructions: Array<
    | { type: 'CNAME'; value: string }
    | { type: 'A'; value: string }
  >
}

/**
 * Pega status de configuração de um domínio: se DNS já aponta certo,
 * se cert tá provisionado, e instruções de DNS quando ainda pendente.
 *
 * Combina dois endpoints da Vercel:
 *   - `GET /v9/projects/{id}/domains/{domain}` — info básica + verified
 *   - `GET /v6/domains/{domain}/config` — DNS atual e instruções
 */
export async function getDomainStatus(domain: string): Promise<DomainResult<DomainStatus>> {
  const env = readEnv()
  if (!env.ok) return env

  const projUrl = `${API_BASE}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}?teamId=${env.teamId}`
  const cfgUrl = `${API_BASE}/v6/domains/${encodeURIComponent(domain)}/config?teamId=${env.teamId}`

  const [projResp, cfgResp] = await Promise.all([
    fetch(projUrl, { headers: { Authorization: `Bearer ${env.token}` } }),
    fetch(cfgUrl, { headers: { Authorization: `Bearer ${env.token}` } }),
  ])

  if (!projResp.ok) {
    const body = (await projResp.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    return {
      ok: false,
      error: body.error?.code ?? `http_${projResp.status}`,
      message: body.error?.message ?? `HTTP ${projResp.status}`,
    }
  }

  const projData = (await projResp.json()) as {
    verified?: boolean
    verification?: Array<{ type: string; domain: string; value: string }>
  }
  const cfgData = cfgResp.ok
    ? ((await cfgResp.json()) as { misconfigured?: boolean; configuredBy?: string | null })
    : { misconfigured: true, configuredBy: null }

  const verified = projData.verified === true
  const configurationOk = verified && !cfgData.misconfigured

  // Instruções padrão Vercel: CNAME pra `cname.vercel-dns-0.com` (preferido)
  // ou A pra `76.76.21.21`. Quando já tá verificado, sem instruções.
  const instructions: DomainStatus['instructions'] = configurationOk
    ? []
    : [
        { type: 'CNAME', value: 'cname.vercel-dns-0.com' },
        { type: 'A', value: '76.76.21.21' },
      ]

  return {
    ok: true,
    data: { verified, configurationOk, instructions },
  }
}
