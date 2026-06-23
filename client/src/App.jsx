import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { useProfile } from './context/ProfileContext'
import BottomNav from './components/BottomNav'
import { SizzleLoader } from './components/ui/primitives'

import AuthScreen from './pages/AuthScreen'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Library from './pages/Library'
import RecipeDetail from './pages/RecipeDetail'
import AddHub from './pages/add/AddHub'
import AddManual from './pages/add/AddManual'
import AddImport from './pages/add/AddImport'
import EditRecipe from './pages/add/EditRecipe'
import Plan from './pages/Plan'
import SwipePlanner from './pages/SwipePlanner'
import ManualPlanner from './pages/ManualPlanner'
import Shopping from './pages/Shopping'
import Community from './pages/Community'
import Settings from './pages/Settings'

function FullLoader() {
  return <div className="app-shell" style={{ display: 'grid', placeContent: 'center' }}><SizzleLoader message="Warming up…" /></div>
}

const NAV_ROUTES = ['/', '/recipes', '/plan', '/shopping', '/community']

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, onboarded } = useProfile()
  const location = useLocation()

  if (authLoading) return <FullLoader />
  if (!user) return <div className="app-shell"><AuthScreen /></div>
  if (profileLoading) return <FullLoader />
  if (!onboarded) return <div className="app-shell"><Onboarding /></div>

  const showNav = NAV_ROUTES.includes(location.pathname)

  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname.split('/')[1] || 'home'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/recipes" element={<Library />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/recipes/:id/edit" element={<EditRecipe />} />
            <Route path="/add" element={<AddHub />} />
            <Route path="/add/manual" element={<AddManual />} />
            <Route path="/add/url" element={<AddImport mode="url" />} />
            <Route path="/add/photo" element={<AddImport mode="photo" />} />
            <Route path="/add/social" element={<AddImport mode="social" />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/plan/swipe" element={<SwipePlanner />} />
            <Route path="/plan/manual" element={<ManualPlanner />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/community" element={<Community />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {showNav && <BottomNav />}
    </div>
  )
}
