import { test, expect } from '@playwright/test'

/**
 * Smoke tests CI-friendly: rodam contra build prod com env dummy
 * (sem Supabase real, sem JWT, sem migration aplicada). Cobertura
 * mínima: proxy + render do dev index. Quando precisarmos de cobertura
 * full-stack (login OTP, criar appointment), criar projeto Supabase
 * dedicado pra CI e expor secrets — issue separada.
 */

test.describe('Proxy headers', () => {
  test('marca x-ara-area=root no host padrão (sem subdomínio de tenant)', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 })
    // Pode ser 200 (dev index) ou 307/308 (prod redirect) — ambos têm o header.
    expect(res.headers()['x-ara-area']).toBe('root')
  })
})

test.describe('Dev root index', () => {
  // O webServer da config sobe o servidor com NEXT_PUBLIC_ENV=development
  // — em prod root host redireciona pra aralabs.com.br, mas pra fins de
  // smoke local/CI roda sempre em dev.
  test('renderiza índice de tenants pra navegação dev', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Índice local/i })).toBeVisible()
  })
})
