/**
 * Config Sentry pro browser (client components, route handlers client-side).
 * Carregado pelo Next.js automaticamente.
 *
 * Mantém scope mínimo no free tier (5K errors/mês):
 *   - Sem replay (custa quota separada)
 *   - Sem performance tracing (Vercel Analytics já cobre Core Web Vitals)
 *   - Só captura erros não-tratados + chamadas explícitas a Sentry.captureException
 *
 * DSN vem de NEXT_PUBLIC_SENTRY_DSN (público, OK exposto). Se não estiver
 * setada (dev local sem Sentry), o init é no-op.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Só ativa em prod por default. Pra debugar dev, override via env.
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Captura 100% dos errors. Performance fica em 0 pra não gastar quota.
    tracesSampleRate: 0,
    // Não envia eventos de PII automaticamente. Quando precisar enriquecer,
    // chamar setUser/setContext explicitamente.
    sendDefaultPii: false,
  })
}
