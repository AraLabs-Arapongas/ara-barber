'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Last resort error boundary do App Router. Captura erros que não foram
 * pegos por nenhum `error.tsx` mais específico (incluindo erros no
 * próprio root layout). Reporta pro Sentry e renderiza fallback mínimo.
 *
 * Ref: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Já fomos avisados. Tente novamente em alguns instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  )
}
