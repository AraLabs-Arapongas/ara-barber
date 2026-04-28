import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT ?? '3008'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // mobile-safari (webkit) ainda comentado: requer `playwright install
    // webkit` no CI, dobra wallclock e nosso smoke atual não testa nada
    // mobile-specific. Reabilitar quando tivermos suite real.
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 14'] },
    // },
  ],
  webServer: {
    // CI: passa env=development pra forçar render do DevRootIndex em vez
    // do redirect pra aralabs.com.br, e dummy supabase keys pra build
    // não falhar (testes não tocam DB).
    command: `pnpm build && pnpm start`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'dummy',
      SUPABASE_SECRET_KEY: 'dummy',
      NEXT_PUBLIC_APP_BASE_HOST: 'aralabs.com.br',
      NEXT_PUBLIC_PLATFORM_HOST: 'admin.aralabs.com.br',
      NEXT_PUBLIC_DEV_BASE_HOST: 'lvh.me',
    },
  },
})
