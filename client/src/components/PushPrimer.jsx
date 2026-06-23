import { useState } from 'react'
import { Sheet, Button, useToast } from './ui/primitives'
import { enablePush, pushSupported, permissionState } from '../lib/push'
import { useProfile } from '../context/ProfileContext'

// Shown at a *sensible moment* — right after a plan is created — to ask for
// notification permission so we can send replanning reminders. We never prompt
// on first load. If already granted/denied/unsupported, it renders nothing.
export default function PushPrimer({ open, onClose }) {
  const toast = useToast()
  const { update } = useProfile()
  const [busy, setBusy] = useState(false)

  if (!pushSupported() || permissionState() !== 'default') return null

  async function allow() {
    setBusy(true)
    try {
      const ok = await enablePush()
      if (ok) { await update({ push_enabled: true }); toast.success("Great — we'll remind you before your plan runs out.") }
      else toast.show('No worries — you can turn reminders on in Settings.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Never run out of a plan">
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🔔</div>
        <p className="muted" style={{ lineHeight: 1.55, margin: '0 0 20px' }}>
          We'll nudge you <b>2 days</b> before this plan ends — and only follow up if you haven't started the next one. No spam.
        </p>
        <Button block lg loading={busy} onClick={allow}>Turn on reminders</Button>
        <Button variant="soft" block onClick={onClose} style={{ marginTop: 10 }}>Maybe later</Button>
      </div>
    </Sheet>
  )
}
