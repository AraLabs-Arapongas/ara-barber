'use client'

import { useActionState } from 'react'
import { ShieldCheck, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Monogram } from '@/components/brand/logo'
import { loginPlatformAdminAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export default function PlatformLoginPage() {
  const [state, formAction, pending] = useActionState(loginPlatformAdminAction, INITIAL)

  return (
    <main className="noise-overlay relative flex min-h-screen flex-col bg-bg-subtle">
      {/* Faixa institucional no topo */}
      <header className="relative z-10 border-b border-border/60 bg-surface/80 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Monogram className="h-8 w-8" />
            <span className="font-display text-[1rem] font-semibold tracking-tight text-fg">
              Ara Barber
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Acesso restrito
          </span>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader>
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-brand-accent-fg/70">
                Painel interno
              </p>
              <h1 className="font-display text-[1.75rem] leading-[1.1] tracking-tight text-fg">
                Administração
                <span
                  className="ml-1 italic text-brand-primary"
                  style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
                >
                  AraLabs
                </span>
              </h1>
              <p className="text-[0.9375rem] text-fg-muted">
                Somente membros da equipe AraLabs devem acessar esta área.
              </p>
            </CardHeader>

            <CardContent>
              <form action={formAction} className="space-y-5" id="platform-login-form">
                <Input
                  label="E-mail corporativo"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nome@aralabs.com.br"
                  leftIcon={<Mail className="h-4 w-4" />}
                />

                <Input
                  label="Senha"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                />

                {state.error ? (
                  <Alert variant="error" title="Acesso negado">
                    {state.error}
                  </Alert>
                ) : null}
              </form>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-3">
              <Button
                type="submit"
                form="platform-login-form"
                size="lg"
                fullWidth
                loading={pending}
                loadingText="Autenticando..."
              >
                Entrar na plataforma
              </Button>
              <p className="text-center text-[0.75rem] text-fg-subtle">
                Todas as ações nesta área ficam registradas em auditoria.
              </p>
            </CardFooter>
          </Card>

          <p className="mt-6 text-center text-[0.75rem] text-fg-subtle">
            Ara Barber · Plataforma administrativa · v0.1
          </p>
        </div>
      </div>
    </main>
  )
}
