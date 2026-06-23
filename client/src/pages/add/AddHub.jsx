import { useNavigate } from 'react-router-dom'
import { IconButton } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import './add.css'

const METHODS = [
  { to: '/add/manual', icon: 'pencil', title: 'Manual entry', desc: 'Type it in yourself', tint: 'a' },
  { to: '/add/url', icon: 'link', title: 'Paste a link', desc: 'Import from any recipe site', tint: 'b' },
  { to: '/add/photo', icon: 'camera', title: 'Snap a photo', desc: 'A cookbook page or card', tint: 'c' },
  { to: '/add/social', icon: 'film', title: 'Social video', desc: 'TikTok, Instagram, YouTube', tint: 'd' },
]

export default function AddHub() {
  const navigate = useNavigate()
  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 8 }}>
        <IconButton onClick={() => navigate(-1)}><Icon name="arrowLeft" size={20} /></IconButton>
        <h1 style={{ fontSize: 26 }}>Add a recipe</h1>
      </div>
      <p className="muted" style={{ margin: '0 0 22px' }}>Four ways in — they all land in your cookbook the same.</p>
      <div className="add-grid">
        {METHODS.map((m) => (
          <button key={m.to} className={`add-method tint-${m.tint}`} onClick={() => navigate(m.to)}>
            <span className="am-icon"><Icon name={m.icon} size={20} /></span>
            <b>{m.title}</b>
            <span className="am-desc">{m.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
