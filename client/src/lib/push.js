// Web Push subscription flow (client side).
// We ask for permission at a *sensible moment* (after a plan is created),
// never on first load — see PushPrimer.
// The VAPID public key comes from the server's /api/config so there's no
// client build-time env to manage.
import api from '../api/client'

let cachedVapidKey = null

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function getVapidKey() {
  if (cachedVapidKey !== null) return cachedVapidKey
  const { data } = await api.get('/config')
  cachedVapidKey = data.vapidPublicKey || ''
  return cachedVapidKey
}

export function permissionState() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

// Request permission + subscribe + persist to backend. Returns true on success.
export async function enablePush() {
  if (!pushSupported()) throw new Error('Push is not supported on this device.')
  const vapid = await getVapidKey()
  if (!vapid) throw new Error('Push is not configured on the server yet.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    })
  }
  await api.post('/auth/push-subscription', { subscription: sub.toJSON() })
  return true
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await api.post('/auth/push-subscription', { unsubscribe: true })
    await sub.unsubscribe()
  }
}
