import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, useToast } from '../components/ui/primitives'
import './auth.css'

export default function AuthScreen() {
  const { login, register } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signup') // signup | signin
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signup') {
        await register(email, name, password)
        toast.success('Welcome to Sizzler')
      } else {
        await login(email, password)
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="auth-flame" />
        <h1>Sizzler</h1>
        <p>Save recipes. Plan the week. Shop in one sweep.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs">
          <button type="button" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</button>
        </div>
        {mode === 'signup' && (
          <Field label="Your name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        </Field>
        <Button type="submit" block lg loading={busy}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
        <p className="auth-fine">By continuing you agree to keep your recipes delicious.</p>
      </form>
    </div>
  )
}
