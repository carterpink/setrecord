import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MapPin,
  Calendar,
  Pencil,
  Check,
  X,
  Layers,
  Sparkles,
  ChevronDown,
  ClipboardList
} from 'lucide-react'
import type { PlaySession, SessionMetadataPatch, VenueType, SetSlot } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { RecallTrackLine } from './RecallTrackLine'
import { BriefPanel } from './BriefPanel'
import { AnimatePresence } from '@/components/shared/Motion'

const EVENT_TYPES: VenueType[] = ['club', 'festival', 'bar', 'private', 'outdoor']
const SET_SLOTS: SetSlot[] = ['opener', 'peak', 'closer', 'b2b', 'other']

function formatDate(iso: string | undefined, locale: string, undated: string): string {
  if (!iso) return undated
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** A single editable gig row. */
function GigRow({ gig }: { gig: PlaySession }): React.JSX.Element {
  const { t, i18n } = useTranslation('recall')
  const updateGig = useRecallStore((s) => s.updateGig)
  const loadGigTracklist = useRecallStore((s) => s.loadGigTracklist)
  const loadBrief = useRecallStore((s) => s.loadBrief)
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
          <span>{formatDate(gig.performedAt, i18n.language, t('gigs.undated'))}</span>
        </div>
        <div className="gig-row-name" title={gig.name}>
          {gig.name}
        </div>
        <button
          type="button"
          className="gig-row-tracks"
          onClick={() => void loadGigTracklist(gig)}
          title={t('gigs.viewTracklist')}
        >
          <Layers size={13} strokeWidth={1.5} />
          {gig.trackCount}
        </button>
        {(gig.venue || gig.eventType) && (
          <button
            type="button"
            className="gig-row-tracks"
            onClick={() => void loadBrief(gig.venue ?? '', gig.eventType)}
            title="Game plan — pre-gig brief from your history here"
          >
            <ClipboardList size={13} strokeWidth={1.5} />
          </button>
        )}
        {!editing && (
          <button
            type="button"
            className="gig-row-edit"
            onClick={startEdit}
            title={t('gigs.editGig')}
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!editing ? (
        <div className="gig-row-meta">
          <span className={`gig-chip${gig.venue ? '' : ' gig-chip-empty'}`}>
            <MapPin size={12} strokeWidth={1.5} />
            {gig.venue || t('gigs.addVenue')}
            {isAutoVenue && (
              <span className="gig-auto-badge" title={t('gigs.autoBadgeTitle')}>
                <Sparkles size={10} strokeWidth={1.5} /> {t('gigs.autoBadge')}
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
            {t('gigs.fields.venue')}
            <input
              value={String(draft.venue ?? '')}
              autoFocus
              placeholder={t('gigs.placeholders.venue')}
              onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))}
            />
          </label>
          <label>
            {t('gigs.fields.city')}
            <input
              value={String(draft.city ?? '')}
              placeholder={t('gigs.placeholders.city')}
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </label>
          <label>
            {t('gigs.fields.country')}
            <input
              value={String(draft.country ?? '')}
              placeholder={t('gigs.placeholders.country')}
              onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
            />
          </label>
          <label>
            {t('gigs.fields.event')}
            <select
              value={draft.eventType ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, eventType: (e.target.value || null) as VenueType | null }))
              }
            >
              <option value="">{t('gigs.noneOption')}</option>
              {EVENT_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('gigs.fields.slot')}
            <select
              value={draft.setSlot ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, setSlot: (e.target.value || null) as SetSlot | null }))
              }
            >
              <option value="">{t('gigs.noneOption')}</option>
              {SET_SLOTS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <div className="gig-edit-actions">
            <button type="button" className="gig-edit-save" onClick={() => void save()}>
              <Check size={14} strokeWidth={2} /> {t('gigs.save')}
            </button>
            <button type="button" className="gig-edit-cancel" onClick={() => setEditing(false)}>
              <X size={14} strokeWidth={2} /> {t('gigs.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Bulk back-fill: assign venue/city/event to every gig in a date range. */
function BulkAssign(): React.JSX.Element {
  const { t } = useTranslation('recall')
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
      setResult(t('gigs.bulk.needDateBound'))
      return
    }
    const patch: SessionMetadataPatch = {}
    if (venue.trim()) patch.venue = venue.trim()
    if (city.trim()) patch.city = city.trim()
    if (eventType) patch.eventType = eventType
    if (Object.keys(patch).length === 0) {
      setResult(t('gigs.bulk.needField'))
      return
    }
    const n = await bulkAssignGigs(
      { after: after || undefined, before: before || undefined },
      patch
    )
    setResult(t('gigs.bulk.updated', { count: n }))
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
        {t('gigs.bulk.toggle')}
      </button>
      {open && (
        <div className="gig-bulk-form">
          <div className="gig-bulk-grid">
            <label>
              {t('gigs.fields.from')}
              <input type="date" value={after} onChange={(e) => setAfter(e.target.value)} />
            </label>
            <label>
              {t('gigs.fields.to')}
              <input type="date" value={before} onChange={(e) => setBefore(e.target.value)} />
            </label>
            <label>
              {t('gigs.fields.venue')}
              <input
                value={venue}
                placeholder={t('gigs.placeholders.bulkVenue')}
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
            <label>
              {t('gigs.fields.city')}
              <input
                value={city}
                placeholder={t('gigs.placeholders.bulkCity')}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              {t('gigs.fields.event')}
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as VenueType | '')}
              >
                <option value="">{t('gigs.noneOption')}</option>
                {EVENT_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="gig-bulk-actions">
            <button type="button" className="gig-edit-save" onClick={() => void apply()}>
              {t('gigs.bulk.apply')}
            </button>
            {result && <span className="gig-bulk-result">{result}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function GigsSection(): React.JSX.Element {
  const { t, i18n } = useTranslation('recall')
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const gigs = useRecallStore((s) => s.gigs)
  const loading = useRecallStore((s) => s.gigsLoading)
  const gigFilter = useRecallStore((s) => s.gigFilter)
  const applyGigFilter = useRecallStore((s) => s.applyGigFilter)
  const loadGigs = useRecallStore((s) => s.loadGigs)
  const tracklist = useRecallStore((s) => s.gigTracklist)
  const clearGigTracklist = useRecallStore((s) => s.clearGigTracklist)
  const activeBrief = useRecallStore((s) => s.activeBrief)
  const briefOpen = useRecallStore((s) => s.briefOpen)
  const briefLoading = useRecallStore((s) => s.briefLoading)
  const clearBrief = useRecallStore((s) => s.clearBrief)

  useEffect(() => {
    void loadGigs()
  }, [loadGigs])

  const filterLabel = useMemo(() => {
    if (!gigFilter) return null
    const bits: string[] = []
    if (gigFilter.venue) bits.push(t('gigs.filterAt', { venue: gigFilter.venue }))
    if (gigFilter.city) bits.push(t('gigs.filterIn', { city: gigFilter.city }))
    if (gigFilter.eventType) bits.push(gigFilter.eventType)
    if (gigFilter.after && gigFilter.before)
      bits.push(t('gigs.filterRange', { after: gigFilter.after, before: gigFilter.before }))
    else if (gigFilter.after) bits.push(t('gigs.filterSince', { after: gigFilter.after }))
    return bits.join(' · ') || t('gigs.filtered')
  }, [gigFilter, t])

  if (!hasLibrary) {
    return (
      <div className="recall-section">
        <header className="recall-section-head">
          <h2 className="ss-h2">{t('gigs.title')}</h2>
          <p className="recall-section-sub">{t('gigs.subtitleEmpty')}</p>
        </header>
        <NoLibraryState body={t('gigs.noLibraryBody')} />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">{t('gigs.title')}</h2>
        <p className="recall-section-sub">{t('gigs.subtitle')}</p>
      </header>

      {gigFilter && (
        <div className="gig-filter-chip">
          <span>{t('gigs.showingFiltered', { filter: filterLabel })}</span>
          <button type="button" onClick={() => void applyGigFilter(null)}>
            <X size={13} strokeWidth={2} /> {t('gigs.clear')}
          </button>
        </div>
      )}

      <BulkAssign />

      {loading && <div className="recall-empty">{t('gigs.loading')}</div>}
      {!loading && gigs.length === 0 && (
        <div className="recall-empty">{gigFilter ? t('gigs.noMatch') : t('gigs.noSessions')}</div>
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
                  {formatDate(tracklist.session.performedAt, i18n.language, t('gigs.undated'))}
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

      <AnimatePresence>
        {briefOpen && <BriefPanel brief={activeBrief} loading={briefLoading} onClose={clearBrief} />}
      </AnimatePresence>
    </div>
  )
}
