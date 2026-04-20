'use client'

import { useEffect, useState } from 'react'
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

/**
 * Bottom sheet que oferece instalação do PWA. Só dispara no client, uma vez
 * por sessão de visita, se (1) não está rodando standalone e (2) não foi
 * dispensado nos últimos 30 dias.
 */
export function PwaInstallPrompt() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'chrome' | 'manual'>('chrome')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) {
      void markPwaInstalled()
      return
    }
    if (wasDismissedRecently()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('chrome')
      setOpen(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    let iosTimer: ReturnType<typeof setTimeout> | null = null
    if (isIOS()) {
      iosTimer = setTimeout(() => {
        if (!wasDismissedRecently()) {
          setMode('manual')
          setOpen(true)
        }
      }, 1500)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (iosTimer) clearTimeout(iosTimer)
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

  return (
    <BottomSheet
      open={open}
      onClose={later}
      title="Instale o app"
      description={
        mode === 'chrome'
          ? 'Receba avisos e agende mais rápido.'
          : 'No Safari iOS, use o menu compartilhar pra adicionar à tela de início.'
      }
    >
      <div className="space-y-3 pb-2">
        {mode === 'chrome' ? (
          <Button fullWidth onClick={install}>
            Instalar
          </Button>
        ) : (
          <div className="rounded-lg bg-bg-subtle p-4 text-[0.9375rem] text-fg">
            1. Toque no ícone <strong>Compartilhar</strong> (retângulo com seta pra cima).
            <br />
            2. Role e escolha <strong>Adicionar à Tela de Início</strong>.
            <br />
            3. Confirme. Pronto.
          </div>
        )}
        <Button variant="secondary" fullWidth onClick={later}>
          Mais tarde
        </Button>
      </div>
    </BottomSheet>
  )
}
