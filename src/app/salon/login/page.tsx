'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Wordmark, BarberStripeOrnament, ComboGlyph } from '@/components/brand/logo'
import { loginStaffAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export default function SalonLoginPage() {
  const [state, formAction, pending] = useActionState(loginStaffAction, INITIAL)

  return (
    <main className="noise-overlay relative min-h-screen bg-bg">
      {/* Mobile top brand */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 lg:hidden">
        <Wordmark />
        <Link
          href="/"
          className="text-[0.8125rem] text-fg-muted underline-offset-4 hover:underline"
        >
          Voltar
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.05fr_1fr]">
        {/* Decorative brand panel — desktop only */}
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
          <BarberStripeOrnament />

          <div className="relative z-10">
            <Wordmark className="text-[1.5rem]" />
          </div>

          <div className="relative z-10 max-w-md space-y-8">
            <ComboGlyph className="h-44 w-auto text-brand-primary" />

            <div className="space-y-4">
              <h1 className="font-display text-[3rem] leading-[1.02] tracking-[-0.025em] text-fg">
                Seu salão,
                <br />
                <span
                  className="italic text-brand-primary"
                  style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
                >
                  organizado.
                </span>
              </h1>
              <p className="max-w-sm text-[1.0625rem] leading-relaxed text-fg-muted">
                Agenda, equipe e clientes num só lugar — feito pra quem corta cabelo, não pra quem
                programa.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 text-[0.8125rem] text-fg-subtle">
            <span className="h-px w-8 bg-border-strong" />
            <span className="uppercase tracking-[0.18em]">Ara Barber · 2026</span>
          </div>
        </aside>

        {/* Login form */}
        <section className="flex items-center justify-center px-5 pb-10 pt-8 lg:px-14">
          <div className="w-full max-w-105">
            <div className="mb-8 space-y-2">
              <p className="text-[0.8125rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                Equipe do salão
              </p>
              <h2 className="font-display text-[2.25rem] leading-[1.08] tracking-[-0.025em] text-fg">
                Entrar no seu
                <br />
                <span
                  className="italic text-brand-primary"
                  style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
                >
                  painel
                </span>
                <span className="text-brand-accent">.</span>
              </h2>
              <p className="text-[0.9375rem] text-fg-muted">
                Use o e-mail que o dono do salão cadastrou pra você.
              </p>
            </div>

            <form action={formAction} className="space-y-5">
              <Input
                label="E-mail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@salao.com"
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
                <Alert variant="error" title="Não foi possível entrar">
                  {state.error}
                </Alert>
              ) : null}

              <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Entrando...">
                Entrar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>

              <div className="flex flex-col gap-2 pt-2 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/salon/forgot-password"
                  className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Esqueci a senha
                </Link>
                <span className="text-fg-subtle">Sem cadastro? Fale com o dono.</span>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
