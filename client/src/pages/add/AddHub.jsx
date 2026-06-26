import { useNavigate } from 'react-router-dom'
import { IconButton } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import './add.css'

const AI_METHODS = [
  { to: '/add/url', icon: 'link', title: 'Paste a link', desc: 'Import from any recipe website' },
  { to: '/add/photo', icon: 'camera', title: 'Snap a photo', desc: 'From a cookbook or recipe card' },
  { to: '/add/social', icon: 'film', title: 'Social link', desc: 'TikTok, Instagram or YouTube' },
]

export default function AddHub() {
  const navigate = useNavigate()

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
        <IconButton onClick={() => navigate(-1)}><Icon name="arrowLeft" size={20} /></IconButton>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div className="overline">Grow your library</div>
        <h1 style={{ fontSize: 30, marginTop: 4, letterSpacing: '-0.03em' }}>Add a recipe</h1>
      </div>

      <div className="add-group">
        {AI_METHODS.map((m) => (
          <button key={m.to} className="add-row" onClick={() => navigate(m.to)}>
            <span className="ar-ic"><Icon name={m.icon} size={20} /></span>
            <div className="ar-txt"><b>{m.title}</b><span>{m.desc}</span></div>
            <span className="ar-ai">AI</span>
          </button>
        ))}
      </div>

      <button className="add-row dark" onClick={() => navigate('/add/manual')}>
        <span className="ar-ic"><Icon name="pencil" size={20} /></span>
        <div className="ar-txt"><b>Write it out</b><span>Enter the recipe by hand</span></div>
      </button>
    </div>
  )
}
