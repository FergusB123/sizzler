import { useNavigate } from 'react-router-dom'
import { IconButton } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { useGoBack } from '../../lib/useGoBack'
import './add.css'

// One consistent list. Sizzler AI leads with an accent; the rest share the
// same row treatment so nothing feels bolted on.
const METHODS = [
  { to: '/add/ai', icon: 'sparkle', title: 'Sizzler AI', desc: 'Describe a craving, get a full recipe', tag: 'NEW', accent: true },
  { to: '/add/url', icon: 'link', title: 'Paste a link', desc: 'Import from any recipe website', tag: 'AI' },
  { to: '/add/photo', icon: 'camera', title: 'Snap a photo', desc: 'From a cookbook or recipe card', tag: 'AI' },
  { to: '/add/social', icon: 'film', title: 'Social link', desc: 'TikTok, Instagram or YouTube', tag: 'AI' },
  { to: '/add/manual', icon: 'pencil', title: 'Write it out', desc: 'Enter the recipe by hand' },
]

export default function AddHub() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div className="overline">Grow your library</div>
        <h1 style={{ fontSize: 30, marginTop: 4, letterSpacing: '-0.03em' }}>Add a recipe</h1>
      </div>

      <div className="add-group">
        {METHODS.map((m) => (
          <button key={m.to} className={`add-row ${m.accent ? 'accent' : ''}`} onClick={() => navigate(m.to)}>
            <span className="ar-ic"><Icon name={m.icon} size={20} /></span>
            <div className="ar-txt"><b>{m.title}</b><span>{m.desc}</span></div>
            {m.tag && <span className={`ar-tag ${m.accent ? 'new' : ''}`}>{m.tag}</span>}
            <Icon name="chevron" size={17} className="ar-chev" />
          </button>
        ))}
      </div>
    </div>
  )
}
