import type { NextConfig } from 'next'

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
}

export default nextConfig
