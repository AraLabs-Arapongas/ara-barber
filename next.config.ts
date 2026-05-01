import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Dev: permite que o HMR funcione em hosts customizados (lvh.me e subdomínios
  // de tenant). Sem isso, o WebSocket do webpack-hmr fica em retry loop e
  // dispara warnings infinitos no console.
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],

  // Worktrees do .claude/ duplicam pnpm-workspace.yaml, e Turbopack escolhe o
  // ancestral errado por padrão (pasta do repo principal). Fixa o root no cwd
  // do processo (= pasta deste worktree quando rodando `pnpm dev` aqui).
  turbopack: {
    root: import.meta.dirname,
  },

  // next/image whitelist. Como uploads de logo/favicon vão pro nosso
  // bucket Supabase Storage (`tenant-assets`), todas as imagens
  // renderizadas vivem em domínios que nós controlamos. Permitimos
  // qualquer subdomínio supabase.co (cloud) + 127.0.0.1 (Docker local).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Cache Components (Next 16): habilita o directive 'use cache' + cacheLife()
  // + cacheTag() em queries server-side. Cache é por tag (granular), invalidado
  // explicitamente via revalidateTag() em mutations. Reduz drasticamente DB
  // round-trips em RSC re-renders entre navegações.
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
  cacheComponents: true,
}

/**
 * Wrapper Sentry. Funciona mesmo sem envs setadas:
 *   - Sem `NEXT_PUBLIC_SENTRY_DSN`: init é no-op, nada é enviado.
 *   - Sem `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`: source maps
 *     não sobem (stack trace fica minificado em prod), mas captura segue ok.
 *
 * Setar em Vercel pra prod:
 *   - NEXT_PUBLIC_SENTRY_DSN — público, vai no client bundle
 *   - SENTRY_AUTH_TOKEN — secret, só pra build (upload de source maps)
 *   - SENTRY_ORG, SENTRY_PROJECT — nome da org/projeto Sentry
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Silencia logs do plugin no build local quando envs não estão setadas.
  silent: !process.env.CI,
  // Inclui chunks da raiz pra cobrir RSC/middleware nos source maps.
  widenClientFileUpload: true,
  // Remove código de logger em prod pra reduzir bundle.
  disableLogger: true,
  // Sourcemaps: sobem pro Sentry quando SENTRY_AUTH_TOKEN está presente,
  // sem expor publicamente (default do plugin).
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
