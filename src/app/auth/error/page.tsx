import Link from 'next/link'
import { headers } from 'next/headers'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  missing_code: {
    title: 'Link inválido ou expirado',
    body: 'O link que você usou pra entrar pode ter expirado, já ter sido usado, ou ser de um formato antigo. Peça um novo na tela de login.',
  },
  exchange_failed: {
    title: 'Não conseguimos validar o link',
    body: 'O Supabase rejeitou o código de autenticação. Pode ser que o link tenha sido aberto em um browser/dispositivo diferente do que pediu, ou que tenha mais de 1 hora.',
  },
  forbidden: {
    title: 'Sem permissão',
    body: 'Você está logado, mas sua conta não tem acesso a esta área.',
  },
}

const DEFAULT_MESSAGE = {
  title: 'Não conseguimos te autenticar',
  body: 'Algo deu errado no processo de login. Tenta de novo na tela inicial.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; detail?: string }>
}) {
  const { reason, detail } = await searchParams
  const message = (reason ? REASON_MESSAGES[reason] : null) ?? DEFAULT_MESSAGE

  // Resolve o link de "Voltar pro login" pelo subdomínio (área).
  // Em prod: admin.aralabs.com.br/login pra platform; <slug>.aralabs.com.br/admin/login pra staff.
  const h = await headers()
  const area = h.get('x-ara-area') ?? 'root'
  const loginPath = area === 'platform' ? '/login' : '/admin/login'

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <Card className="w-full max-w-md p-8">
        <CardContent className="space-y-4 p-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-[1.25rem] font-semibold leading-tight text-fg">
              {message.title}
            </h1>
          </div>
          <p className="text-[0.875rem] text-fg-muted">{message.body}</p>
          {detail ? (
            <details className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-[0.75rem] text-fg-muted">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <p className="mt-2 font-mono break-all">{detail}</p>
            </details>
          ) : null}
          <Link
            href={loginPath}
            className="inline-flex items-center justify-center rounded-md bg-fg px-4 py-2 text-[0.875rem] font-medium text-bg transition-opacity hover:opacity-90"
          >
            Voltar pra tela de login
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
