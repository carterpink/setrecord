import { useState } from 'react'
import { Radio, Save, Trash2 } from 'lucide-react'
import type { RecordedSetSummary } from '@/types'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'

/** ms offset from set start → "m:ss" (or "h:mm:ss" past an hour). */
function offsetLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** "1h 24m" / "47m" / "3m" from a whole-second duration. */
function durationLabel(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}

interface Props {
  summary: RecordedSetSummary
  /** Persist the set with the (possibly edited) venue. */
  onSave: (venue: string | null) => void
  /** Drop the captured set without saving. */
  onDiscard: () => void
}

/**
 * The decide-after review sheet shown in the main window once a live set ends.
 * The Flight Recorder captured the tracklist automatically; the DJ confirms the
 * room and chooses Save (persist to their gig history) or Discard. Nothing is
 * written until Save.
 */
export function SaveSetSheet({ summary, onSave, onDiscard }: Props): React.JSX.Element {
  const [venue, setVenue] = useState(summary.venue ?? '')
  const count = summary.tracklist.length

  return (
    <Modal onClose={onDiscard} ariaLabel="Review your recorded set" maxWidth={460}>
      <header className="save-set-head">
        <span className="save-set-eyebrow">
          <Radio size={14} strokeWidth={1.6} /> Set recorded
        </span>
        <h3 className="ss-h3" style={{ margin: '4px 0 2px' }}>
          {count} {count === 1 ? 'track' : 'tracks'} · {durationLabel(summary.durationSec)}
        </h3>
        <p className="recall-section-sub" style={{ marginBottom: 12 }}>
          Captured automatically while you played. Save it to your history, or discard.
        </p>
      </header>

      <label className="save-set-venue">
        Venue
        <input
          value={venue}
          autoFocus
          placeholder="Which room was this?"
          onChange={(e) => setVenue(e.target.value)}
        />
      </label>

      <div className="save-set-list">
        {count === 0 ? (
          <p className="recall-section-sub">No tracks were identified for this set.</p>
        ) : (
          summary.tracklist.map((tk, i) => (
            <div key={`${tk.trackId}-${i}`} className="save-set-row">
              <span className="save-set-num mono">{i + 1}</span>
              <span className="save-set-track">
                <span className="save-set-title">{tk.title}</span>
                <span className="save-set-artist">{tk.artist}</span>
              </span>
              <span className="save-set-time mono">{offsetLabel(tk.startMs)}</span>
            </div>
          ))
        )}
      </div>

      <div className="save-set-actions">
        <Button variant="ghost" icon={Trash2} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          variant="primary"
          icon={Save}
          disabled={count === 0}
          onClick={() => onSave(venue.trim() ? venue.trim() : null)}
        >
          Save set
        </Button>
      </div>
    </Modal>
  )
}
