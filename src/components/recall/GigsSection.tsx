import { useEffect, useMemo, useState } from 'react'
import { MapPin, Calendar, Pencil, Check, X, Layers, Sparkles, ChevronDown } from 'lucide-react'
import type { PlaySession, SessionMetadataPatch, VenueType, SetSlot } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { RecallTrackLine } from './RecallTrackLine'

const EVENT_TYPES: VenueType[] = ['club', 'festival', 'bar', 'private', 'outdoor']
const SET_SLOTS: SetSlot[] = ['opener', 'peak', 'closer', 'b2b', 'other']

function formatDate(iso?: string): string {
  if (!iso) return 'Undated'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** A single editable gig row. */
function GigRow({ gig }: { gig: PlaySession }): React.JSX.Element {
  const updateGig = useRecallStore((s) => s.updateGig)
  const loadGigTracklist = useRecallStore((s) => s.loadGigTracklist)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SessionMetadataPatch>({})

  const startEdit = (): void => {
    setDraft({
      venue: gig.venue ?? '',
      eventType: gig.eventType ?? null,
      city: gig.city ?? '',
      country: gig.country ?? '',
      setSlot: gig.setSlot ?? null
    })
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    await updateGig(gig.id, {
      venue: draft.venue ? String(draft.venue).trim() : null,
      eventType: draft.eventType || null,
      city: draft.city ? String(draft.city).trim() : null,
      country: draft.country ? String(draft.country).trim() : null,
      setSlot: draft.setSlot || null
    })
    setEditing(false)
  }

  const isAutoVenue = gig.venue && gig.venueSource === 'auto'

  return (
    <div className="gig-row glass-2">
      <div className="gig-row-main">
        <div className="gig-row-when">
          <Calendar size={14} strokeWidth={1.5} />
          <span>{formatDate(gig.performedAt)}</span>
        </div>
        <div className="gig-row-name" title={gig.name}>
          {gig.name}
        </div>
        <button
          type="button"
          className="gig-row-tracks"
          onClick={() => void loadGigTracklist(gig)}
          title="View tracklist"
        >
          <Layers size={13} strokeWidth={1.5} />
          {gig.trackCount}
        </button>
        {!editing && (
          <button type="button" className="gig-row-edit" onClick={startEdit} title="Edit gig">
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!editing ? (
        <div className="gig-row-meta">
          <span className={`gig-chip${gig.venue ? '' : ' gig-chip-empty'}`}>
            <MapPin size={12} strokeWidth={1.5} />
            {gig.venue || 'Add venue'}
            {isAutoVenue && (
              <span
                className="gig-auto-badge"
                title="Auto-detected from the session name — click edit to confirm"
              >
                <Sparkles size={10} strokeWidth={1.5} /> auto
              </span>
            )}
          </span>
          {gig.eventType && <span className="gig-chip gig-chip-soft">{gig.eventType}</span>}
          {gig.city && <span className="gig-chip gig-chip-soft">{gig.city}</span>}
          {gig.setSlot && <span className="gig-chip gig-chip-soft">{gig.setSlot}</span>}
        </div>
      ) : (
        <div className="gig-row-edit-form">
          <label>
            Venue
            <input
              value={String(draft.venue ?? '')}
              autoFocus
              placeholder="e.g. Hi Ibiza"
              onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))}
            />
          </label>
          <label>
            City
            <input
              value={String(draft.city ?? '')}
              placeholder="e.g. Ibiza"
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </label>
          <label>
            Country
            <input
              value={String(draft.country ?? '')}
              placeholder="e.g. Spain"
              onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
            />
          </label>
          <label>
            Event
            <select
              value={draft.eventType ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, eventType: (e.target.value || null) as VenueType | null }))
              }
            >
              <option value="">—</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Slot
            <select
              value={draft.setSlot ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, setSlot: (e.target.value || null) as SetSlot | null }))
              }
            >
              <option value="">—</option>
              {SET_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="gig-edit-actions">
            <button type="button" className="gig-edit-save" onClick={() => void save()}>
              <Check size={14} strokeWidth={2} /> Save
            </button>
            <button type="button" className="gig-edit-cancel" onClick={() => setEditing(false)}>
              <X size={14} strokeWidth={2} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Bulk back-fill: assign venue/city/event to every gig in a date range. */
function BulkAssign(): React.JSX.Element {
  const bulkAssignGigs = useRecallStore((s) => s.bulkAssignGigs)
  const [open, setOpen] = useState(false)
  const [after, setAfter] = useState('')
  const [before, setBefore] = useState('')
  const [venue, setVenue] = useState('')
  const [city, setCity] = useState('')
  const [eventType, setEventType] = useState<VenueType | ''>('')
  const [result, setResult] = useState<string | null>(null)

  const apply = async (): Promise<void> => {
    if (!after && !before) {
      setResult('Pick at least one date bound.')
      return
    }
    const patch: SessionMetadataPatch = {}
    if (venue.trim()) patch.venue = venue.trim()
    if (city.trim()) patch.city = city.trim()
    if (eventType) patch.eventType = eventType
    if (Object.keys(patch).length === 0) {
      setResult('Set at least one field to assign.')
      return
    }
    const n = await bulkAssignGigs(
      { after: after || undefined, before: before || undefined },
      patch
    )
    setResult(`Updated ${n} ${n === 1 ? 'gig' : 'gigs'}.`)
  }

  return (
    <div className="gig-bulk glass-2">
      <button type="button" className="gig-bulk-toggle" onClick={() => setOpen((o) => !o)}>
        <ChevronDown
          size={15}
          strokeWidth={1.5}
          style={{
            transform: open ? 'rotate(0)' : 'rotate(-90deg)',
            transition: 'transform 150ms'
          }}
        />
        Bulk assign a residency or run of dates
      </button>
      {open && (
        <div className="gig-bulk-form">
          <div className="gig-bulk-grid">
            <label>
              From
              <input type="date" value={after} onChange={(e) => setAfter(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={before} onChange={(e) => setBefore(e.target.value)} />
            </label>
            <label>
              Venue
              <input
                value={venue}
                placeholder="Hi Ibiza"
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
            <label>
              City
              <input value={city} placeholder="Ibiza" onChange={(e) => setCity(e.target.value)} />
            </label>
            <label>
              Event
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as VenueType | '')}
              >
                <option value="">—</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="gig-bulk-actions">
            <button type="button" className="gig-edit-save" onClick={() => void apply()}>
              Apply to matching gigs
            </button>
            {result && <span className="gig-bulk-result">{result}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function GigsSection(): React.JSX.Element {
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const gigs = useRecallStore((s) => s.gigs)
  const loading = useRecallStore((s) => s.gigsLoading)
  const gigFilter = useRecallStore((s) => s.gigFilter)
  const applyGigFilter = useRecallStore((s) => s.applyGigFilter)
  const loadGigs = useRecallStore((s) => s.loadGigs)
  const tracklist = useRecallStore((s) => s.gigTracklist)
  const clearGigTracklist = useRecallStore((s) => s.clearGigTracklist)

  useEffect(() => {
    void loadGigs()
  }, [loadGigs])

  const filterLabel = useMemo(() => {
    if (!gigFilter) return null
    const bits: string[] = []
    if (gigFilter.venue) bits.push(`at ${gigFilter.venue}`)
    if (gigFilter.city) bits.push(`in ${gigFilter.city}`)
    if (gigFilter.eventType) bits.push(gigFilter.eventType)
    if (gigFilter.after && gigFilter.before) bits.push(`${gigFilter.after} → ${gigFilter.before}`)
    else if (gigFilter.after) bits.push(`since ${gigFilter.after}`)
    return bits.join(' · ') || 'filtered'
  }, [gigFilter])

  if (!hasLibrary) {
    return (
      <div className="recall-section">
        <header className="recall-section-head">
          <h2 className="ss-h2">Gigs</h2>
          <p className="recall-section-sub">Every set you’ve played — when, where, and what.</p>
        </header>
        <NoLibraryState body="Your performed sessions show up here once you import a library with Rekordbox history (or mark a set as performed)." />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">Gigs</h2>
        <p className="recall-section-sub">
          Every set you’ve played. Venues auto-fill from your history-session names — edit or bulk
          back-fill them, then ask things like “songs I played at Hi Ibiza”.
        </p>
      </header>

      {gigFilter && (
        <div className="gig-filter-chip">
          <span>Showing gigs {filterLabel}</span>
          <button type="button" onClick={() => void applyGigFilter(null)}>
            <X size={13} strokeWidth={2} /> Clear
          </button>
        </div>
      )}

      <BulkAssign />

      {loading && <div className="recall-empty">Loading your gigs…</div>}
      {!loading && gigs.length === 0 && (
        <div className="recall-empty">
          {gigFilter
            ? 'No gigs match this filter.'
            : 'No performed sessions yet — import Rekordbox history or mark a set as performed.'}
        </div>
      )}

      <div className="gig-list">
        {gigs.map((g) => (
          <GigRow key={g.id} gig={g} />
        ))}
      </div>

      {tracklist && (
        <div className="gig-tracklist-overlay" onClick={clearGigTracklist}>
          <div className="gig-tracklist glass-1" onClick={(e) => e.stopPropagation()}>
            <header className="gig-tracklist-head">
              <div>
                <h3 className="ss-h3">{tracklist.session.name}</h3>
                <span className="recall-section-sub">
                  {formatDate(tracklist.session.performedAt)}
                  {tracklist.session.venue ? ` · ${tracklist.session.venue}` : ''}
                </span>
              </div>
              <button type="button" onClick={clearGigTracklist}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </header>
            <div className="recall-list">
              {tracklist.tracks.map((st) => (
                <RecallTrackLine key={st.id} track={st.track} compact />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
