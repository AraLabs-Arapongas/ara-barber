/**
 * Hook do Next.js — chamado uma vez quando server arranca. Carrega o
 * config do Sentry específico do runtime (Node ou Edge).
 *
 * O config do client (sentry.client.config.ts) é injetado pelo plugin
 * do Sentry no bundle do navegador automaticamente; não precisa ser
 * importado aqui.
 *
 * Ref: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
