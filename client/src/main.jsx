import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ProfileProvider } from './context/ProfileContext'
import { ToastProvider } from './components/ui/primitives'
import { registerServiceWorker } from './lib/pwa'
import './index.css'

// Fade out the first-paint splash once React mounts.
function dismissSplash() {
  const s = document.getElementById('boot-splash')
  if (s) {
    s.classList.add('leaving')
    setTimeout(() => s.remove(), 520)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

requestAnimationFrame(dismissSplash)
registerServiceWorker()
