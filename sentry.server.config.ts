/**
 * Config Sentry pro Node runtime (server components, server actions, route
 * handlers server-side). Carregado via instrumentation.ts.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}
