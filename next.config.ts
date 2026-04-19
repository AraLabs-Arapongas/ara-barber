import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Dev: permite que o HMR funcione em hosts customizados (lvh.me e subdomínios
  // de tenant). Sem isso, o WebSocket do webpack-hmr fica em retry loop e
  // dispara warnings infinitos no console.
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
}

export default nextConfig
