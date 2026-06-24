import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icon'
import './ui.css'

export function Button({ variant = 'primary', block, lg, loading, children, className = '', ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${lg ? 'btn-lg' : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  )
}

export function IconButton({ children, ...rest }) {
  return <button className="icon-btn" {...rest}>{children}</button>
}

export function Badge({ kind = '', children }) {
  return <span className={`badge ${kind ? `badge-${kind}` : ''}`}>{children}</span>
}

export function Chip({ active, flame, children, ...rest }) {
  return (
    <button type="button" className={`chip ${flame ? 'chip-flame' : ''}`} aria-pressed={!!active} {...rest}>
      {children}
    </button>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="field">
      {label && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 7 }}>{label}</span>}
      {children}
    </label>
  )
}

export function EmptyState({ icon = 'sparkle', title, children, action }) {
  return (
    <div className="empty">
      <div className="glyph"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

const SIZZLE_MESSAGES = [
  'Warming up your kitchen…',
  'Reading the recipe…',
  'Chopping the details…',
  'Tasting for seasoning…',
  'Plating it up…',
]
// Signature brand loader: the mark breathing inside expanding glow rings.
export function SizzleLoader({ message }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (message) return
    const t = setInterval(() => setI((n) => (n + 1) % SIZZLE_MESSAGES.length), 1500)
    return () => clearInterval(t)
  }, [message])
  return (
    <div className="sizzle">
      <div className="sizzle-load">
        <span className="sizzle-ring" />
        <span className="sizzle-ring delay" />
        <img className="sizzle-mark" src="/brand/sizzler-mark.png" alt="" />
      </div>
      <div className="sizzle-msg">{message || SIZZLE_MESSAGES[i]}</div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_e, info) => { if (info.offset.y > 120) onClose() }}
          >
            <div className="sheet-grip" />
            {title && <h2>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---- Toast system ---- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, kind = '') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  const api = { show: (m) => push(m), error: (m) => push(m, 'err'), success: (m) => push(m) }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className={`toast ${t.kind}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
