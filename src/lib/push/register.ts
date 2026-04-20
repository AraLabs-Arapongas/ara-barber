'use client'

import {
  savePushSubscription,
  deleteMyPushSubscription,
} from '@/app/actions/push-subscriptions'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!VAPID_PUBLIC_KEY) return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function currentPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('SW register failed', err)
    return null
  }
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'failed'; error?: string }

export async function requestAndSubscribe(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const reg = await ensureServiceWorker()
  if (!reg) return { ok: false, reason: 'failed', error: 'SW registration failed' }

  try {
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
    }

    const json = sub.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }
    const result = await savePushSubscription({
      endpoint: json.endpoint,
      p256dhKey: json.keys.p256dh,
      authKey: json.keys.auth,
      userAgent: navigator.userAgent,
    })
    if (!result.ok) return { ok: false, reason: 'failed', error: result.error }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function unsubscribe(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await deleteMyPushSubscription(sub.endpoint)
  await sub.unsubscribe()
}
