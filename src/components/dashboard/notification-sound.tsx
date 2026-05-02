'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

const SOUND_URL = '/alarm_sf77.mp3'
const MUTED_STORAGE_KEY = 'ara-agenda:staff:notif-muted'

type Props = {
  tenantId: string
}

/**
 * Toca som quando chega novo agendamento via Supabase Realtime
 * (event INSERT em `appointments` filtrado por tenant). Botão de
 * mute persiste em localStorage.
 *
 * Como funciona o "destravar audio":
 * - Browsers bloqueiam `<audio>.play()` antes de qualquer interação do
 *   usuário (autoplay policy). Por isso, na primeira vez que o staff
 *   tocar no botão de mute (ou clicar em qualquer coisa que dispare o
 *   `unlock`), tocamos o som no volume 0 só pra "ativar" o elemento.
 * - Depois disso, próximos `play()` rodam normal mesmo sem interação.
 *
 * Se o staff entrar e ficar olhando sem clicar nada, o primeiro evento
 * pode ser bloqueado silenciosamente — daí em diante, com pelo menos
 * uma interação acumulada, funciona. Não tem como contornar isso sem
 * mudar a Permissions API ou push notifications.
 *
 * Reusa o canal realtime existente (`RealtimeAppointmentsRefresh` já
 * roda na mesma página); este componente abre um canal separado
 * `appointments:<tenant>:sound` só pra INSERTs. Custo extra é
 * desprezível (um WS subscription a mais, mesmo socket).
 */
export function NotificationSound({ tenantId }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const unlockedRef = useRef(false)
  const [muted, setMuted] = useState(true) // Default: muted até user habilitar
  const [hydrated, setHydrated] = useState(false)

  // Lê preferência do localStorage só no client (evita mismatch SSR).
  useEffect(() => {
    const saved = window.localStorage.getItem(MUTED_STORAGE_KEY)
    // Default: muted=true (silencioso até o staff ativar uma vez).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(saved === null ? true : saved === '1')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  // Inicializa <audio> uma vez. preload=auto pra primeira reprodução
  // não engasgar (~50KB, baixa rapidíssimo).
  useEffect(() => {
    const audio = new Audio(SOUND_URL)
    audio.preload = 'auto'
    audio.volume = 1
    audioRef.current = audio
    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch((err) => {
      // Autoplay bloqueado (sem interação ainda) — log e segue. Próxima
      // tentativa, já com interação, vai funcionar.
      console.warn('[notification-sound] play falhou (autoplay block?)', err)
    })
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      window.localStorage.setItem(MUTED_STORAGE_KEY, next ? '1' : '0')
      // Quando ATIVA o som, toca o sample como preview no mesmo gesto.
      // Bonus: o navegador trata isso como interação do usuário, então
      // destrava o autoplay pra notificações reais que vierem depois
      // sem precisar de click adicional.
      if (!next) {
        const audio = audioRef.current
        if (audio) {
          audio.currentTime = 0
          audio
            .play()
            .then(() => {
              unlockedRef.current = true
            })
            .catch((err) => {
              console.warn('[notification-sound] preview falhou', err)
            })
        }
      }
      return next
    })
  }, [])

  // Subscribe na tabela de appointments só pra INSERT (notificação real
  // de "novo agendamento chegou"). UPDATE/DELETE não tocam som.
  useEffect(() => {
    if (!hydrated) return
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const connect = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token || cancelled) return
      supabase.realtime.setAuth(token)

      channel = supabase
        .channel(`appointments:${tenantId}:sound`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'appointments',
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            if (muted) return
            play()
          },
        )
        .subscribe()
    }

    void connect()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [tenantId, muted, hydrated, play])

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? 'Ativar som de notificações' : 'Silenciar notificações'}
      title={muted ? 'Som de notificações desligado' : 'Som de notificações ligado'}
      className={`inline-flex h-10 w-10 items-center justify-center transition-colors ${
        muted ? 'text-fg-subtle hover:text-fg' : 'text-brand-primary hover:opacity-80'
      }`}
    >
      {muted ? (
        <VolumeX className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Volume2 className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  )
}
