import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { apiError } from '../api/client'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// JWT auth mirroring Botanica: token in localStorage, /auth/me to hydrate.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
    } catch {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    } catch (e) { throw apiError(e) }
  }

  const register = async (email, name, password) => {
    try {
      const res = await api.post('/auth/register', { email, name, password })
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    } catch (e) { throw apiError(e) }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, signOut: logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}
