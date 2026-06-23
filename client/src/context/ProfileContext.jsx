import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getProfile, updateProfile as apiUpdate } from '../lib/api'
import { useAuth } from './AuthContext'

const ProfileContext = createContext(null)
export const useProfile = () => useContext(ProfileContext)

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // The server stores the user's name in `name`; the UI reads `display_name`.
  const normalize = (p) => (p ? { ...p, display_name: p.display_name || p.name } : p)

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return }
    setLoading(true)
    try {
      setProfile(normalize(await getProfile()))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const update = async (patch) => {
    const next = normalize(await apiUpdate(patch))
    setProfile(next)
    return next
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh, update, onboarded: !!profile?.onboarded_at }}>
      {children}
    </ProfileContext.Provider>
  )
}
