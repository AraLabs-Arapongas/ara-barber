'use client'

import { useEffect, useState } from 'react'
import { MoreVertical, Plus, Scroll } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { markPwaInstalled, markPwaInstallDismissed } from '@/app/actions/pwa-tracking'

const DISMISS_KEY = 'ara:pwa-install-dismissed-at'
const DISMISS_DAYS = 30

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS legacy
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  )
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < DISMISS_DAYS * 86_400_000
}

type Mode = 'native' | 'ios' | 'android'

/**
 * Bottom sheet que oferece instalação do PWA. Só dispara no client, uma vez
 * por sessão de visita, se (1) não está rodando standalone e (2) não foi
 * dispensado nos últimos 30 dias.
 *
 * Três modos:
 * - `native`: o browser suporta `beforeinstallprompt` (Chrome/Edge/Samsung).
 *   Mostra botão "Instalar" que chama o prompt nativo.
 * - `ios`: detecta iPhone/iPad via UA. Mostra passo a passo do Safari
 *   (Compartilhar → Adicionar à Tela de Início).
 * - `android`: fallback pra navegadores que não disparam o evento mas
 *   suportam PWA via menu (Firefox Android, Brave, UC Browser etc).
 *   Mostra instrução genérica de abrir menu → Instalar.
 */
export function PwaInstallPrompt() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('native')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) {
      void markPwaInstalled()
      return
    }
    if (wasDismissedRecently()) return

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('native')
      setOpen(true)
      if (fallbackTimer) {
        clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (isIOS()) {
      fallbackTimer = setTimeout(() => {
        if (!wasDismissedRecently()) {
          setMode('ios')
          setOpen(true)
        }
      }, 1500)
    } else {
      // Se `beforeinstallprompt` não disparar em 4s, assume browser sem suporte
      // nativo (Firefox Android, Brave etc) e mostra instruções genéricas.
      fallbackTimer = setTimeout(() => {
        if (!wasDismissedRecently()) {
          setMode('android')
          setOpen(true)
        }
      }, 4000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  async function install() {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        void markPwaInstalled()
      }
    }
    setOpen(false)
    setDeferred(null)
  }

  function later() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    void markPwaInstallDismissed()
    setOpen(false)
  }

  if (!open) return null

  const description =
    mode === 'native'
      ? 'Receba avisos e agende mais rápido.'
      : mode === 'ios'
        ? 'No Safari do iPhone, em 3 passos:'
        : 'No seu navegador, em 3 passos:'

  return (
    <BottomSheet open={open} onClose={later} title="Instale o app" description={description}>
      <div className="space-y-3 pb-2">
        {mode === 'native' ? (
          <Button fullWidth onClick={install}>
            Instalar
          </Button>
        ) : mode === 'ios' ? (
          <IosInstallSteps />
        ) : (
          <AndroidInstallSteps />
        )}
        <Button variant="secondary" fullWidth onClick={later}>
          Mais tarde
        </Button>
      </div>
    </BottomSheet>
  )
}

function IosShareIcon({ className }: { className?: string }) {
  // Aproximação do ícone "Compartilhar" do Safari iOS: quadrado aberto no topo
  // com uma seta apontando pra cima. O render do Safari real é mais curvo, mas
  // essa forma é o suficiente pra reconhecimento visual.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 4v12" />
      <path d="M8 8l4-4 4 4" />
      <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" />
    </svg>
  )
}

function IosInstallSteps() {
  return (
    <ol className="space-y-2">
      <Step
        number={1}
        icon={<IosShareIcon className="h-5 w-5 text-brand-primary" />}
        title="Toque no ícone de Compartilhar"
        hint="Fica na barra inferior do Safari (quadrado com seta ↑)."
      />
      <Step
        number={2}
        icon={<Scroll className="h-4 w-4 text-brand-primary" />}
        title="Role até Adicionar à Tela de Início"
        hint="Dentro do menu que abriu, deslize pra baixo se precisar."
      />
      <Step
        number={3}
        icon={<Plus className="h-4 w-4 text-brand-primary" />}
        title="Toque em Adicionar"
        hint="O ícone aparece na tela inicial do celular."
      />
    </ol>
  )
}

function AndroidInstallSteps() {
  return (
    <ol className="space-y-2">
      <Step
        number={1}
        icon={<MoreVertical className="h-4 w-4 text-brand-primary" />}
        title="Abra o menu do navegador"
        hint="Geralmente três pontinhos (⋮) no canto superior."
      />
      <Step
        number={2}
        icon={<Plus className="h-4 w-4 text-brand-primary" />}
        title="Toque em Instalar app"
        hint='Em alguns navegadores aparece como "Adicionar à tela inicial".'
      />
      <Step
        number={3}
        icon={<Scroll className="h-4 w-4 text-brand-primary" />}
        title="Confirme"
        hint="O ícone aparece na tela inicial, pronto pra usar como app."
      />
    </ol>
  )
}

function Step({
  number,
  icon,
  title,
  hint,
}: {
  number: number
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-bg-subtle p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[0.75rem] font-semibold text-brand-primary-fg">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-fg">{title}</p>
          <span className="shrink-0">{icon}</span>
        </div>
        <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{hint}</p>
      </div>
    </li>
  )
}
