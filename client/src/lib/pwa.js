// Service-worker registration. Called once from main.jsx.
// Uses the virtual module from vite-plugin-pwa.
import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      // Check for updates hourly while the app is open.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
    },
  })
}
