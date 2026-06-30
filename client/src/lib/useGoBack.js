import { useNavigate } from 'react-router-dom'

// Smart "back": pop history when there's somewhere to pop to, otherwise fall
// back to a sensible route. This prevents the back-button loops you get from
// pushing a parent route as a "back" action (which just stacks more history),
// and handles deep-links / refreshes where there's no in-app history to pop.
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
