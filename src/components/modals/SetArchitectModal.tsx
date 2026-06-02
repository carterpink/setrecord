import { useMemo, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { ArrowRight, Loader, Lock, Sparkles, X } from 'lucide-react'
import type { ArchitectParams, EnergyCurveType, SetTrack, SetVibe, VenueType } from '@/types'
import { Button } from '@/components/shared/Button'
import { Chip } from '@/components/shared/Chip'
import { PlaylistSourceDropdown } from '@/components/shared/PlaylistSourceDropdown'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Slider } from '@/components/shared/Slider'
import { Toggle } from '@/components/shared/Toggle'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { motion, AnimatePresence, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { LearnPanel } from '@/components/learn/LearnPanel'
import { explainEnergyArc } from '@/utils/learnMode/explanations'
import { getTargetCurve } from '@/utils/energyCurve'
import { parseArchitectQuery } from '@/utils/architectQuery'

const DEFAULT_PARAMS: ArchitectParams = {
  targetDuration: 60,
  vibe: 'peak',
  slotTime: 'peak',
  crowdAge: 'mixed',
  venueType: 'club',
  bpmMin: 120,
  bpmMax: 132,
  harmonicMixing: true,
  followEnergyCurve: true,
  energyCurveType: 'rise'
}

const VIBES: SetVibe[] = ['peak', 'mixed', 'club', 'warmup', 'closing', 'festival', 'underground']
const VENUES: VenueType[] = ['club', 'festival', 'bar', 'private', 'outdoor']
const SLOT_TIMES = ['early', 'peak', 'late', 'closing'] as const
const CROWD_AGES = ['young', 'mixed', 'mature'] as const
const CURVE_TYPES: EnergyCurveType[] = ['rise', 'peak-sustain', 'wave', 'drop-in']

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function SetArchitectModal(): React.JSX.Element {
  const { closeModal } = useUiStore()
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const { populateFromArchitect } = useSetStore()
  // Subscribe to a stable reference (the tracks array) and derive the filtered list
  // via useMemo — selecting `.filter(...)` directly would return a fresh array each
  // render, tripping zustand's getSnapshot caching guard and causing an update loop.
  const timelineTracks = useSetStore((s) => s.currentSet?.tracks)
  const lockedFromTimeline = useMemo(
    () => (timelineTracks ?? []).filter((t) => t.locked),
    [timelineTracks]
  )
  const playlists = useLibraryStore((s) => s.playlists)
  const playlistTrackIndex = useLibraryStore((s) => s.playlistTrackIndex)
  const totalTracks = useLibraryStore((s) => s.tracks.length)

  // Only leaf playlists are selectable as source chips; folders are organisational.
  const leafPlaylists = useMemo(
    () => playlists.filter((p) => !p.isFolder && p.trackIds.length > 0),
    [playlists]
  )

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [params, setParams] = useState<ArchitectParams>(DEFAULT_PARAMS)
  const [setName, setSetName] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [resultTracks, setResultTracks] = useState<SetTrack[]>([])
  /** Empty array = no constraint (use whole library). */
  const [selectedSourcePlaylistIds, setSelectedSourcePlaylistIds] = useState<string[]>([])

  // Live count of the source pool — gives the user confidence before they hit Build.
  const sourcePoolSize = useMemo(() => {
    if (selectedSourcePlaylistIds.length === 0) return totalTracks
    const union = new Set<string>()
    for (const id of selectedSourcePlaylistIds) {
      const ids = playlistTrackIndex.get(id)
      if (!ids) continue
      for (const t of ids) union.add(t)
    }
    return union.size
  }, [selectedSourcePlaylistIds, playlistTrackIndex, totalTracks])

  function patch<K extends keyof ArchitectParams>(key: K, value: ArchitectParams[K]): void {
    setParams((p) => ({ ...p, [key]: value }))
  }

  // Natural-language brief → params (same deterministic tech as Recall conversations).
  const [nlText, setNlText] = useState('')
  const [nlSummary, setNlSummary] = useState('')
  function applyNl(): void {
    const { params: parsed, summary } = parseArchitectQuery(nlText)
    if (Object.keys(parsed).length === 0) {
      setNlSummary('Couldn’t read that — try “2-hour peak club set, 126–130, build then sustain”.')
      return
    }
    setParams((p) => ({ ...p, ...parsed }))
    setNlSummary(`Applied: ${summary}`)
  }

  async function handleBuild(): Promise<void> {
    setIsBuilding(true)
    setBuildError(null)
    try {
      const lockedTracks = lockedFromTimeline.map((t) => ({
        position: t.position,
        trackId: t.trackId
      }))
      const paramsForBuild: ArchitectParams = {
        ...params,
        ...(selectedSourcePlaylistIds.length > 0
          ? { sourcePlaylistIds: selectedSourcePlaylistIds }
          : {}),
        ...(lockedTracks.length > 0 ? { lockedTracks } : {})
      }
      const [setTracks] = await Promise.all([
        window.setsense.buildSet(paramsForBuild) as Promise<SetTrack[]>,
        new Promise<void>((r) => setTimeout(r, 1000))
      ])
      if (!setTracks || setTracks.length === 0) {
        setBuildError('No tracks matched — try widening the BPM range or duration.')
        setIsBuilding(false)
        return
      }
      populateFromArchitect(setTracks, params, setName.trim() || undefined)
      setIsBuilding(false)
      if (learnModeEnabled) {
        setResultTracks(setTracks)
        setStep(3)
      } else {
        closeModal()
      }
    } catch {
      setBuildError('Build failed. Try adjusting your BPM range or duration.')
      setIsBuilding(false)
    }
  }

  const stepTitle = step === 1 ? 'Set the feel' : step === 2 ? 'Set the shape' : 'Set built'
  const stepSubtitle = step === 1 ? 'Step 1 of 2' : step === 2 ? 'Step 2 of 2' : 'Result'

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeModal}
    >
      <FocusLock returnFocus>
        <motion.div
          className="modal glass-3"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ maxWidth: 520 }}
          role="dialog"
          aria-modal="true"
          aria-label="Set Architect"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div>
              <span className="ss-h2">Set Architect</span>
              <span
                className="ss-caption"
                style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}
              >
                {stepSubtitle}
              </span>
            </div>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body">
            {totalTracks === 0 ? (
              <NoLibraryState body="Set Architect builds a full set for you — picking tracks that flow on key, BPM and energy across the night. Import your library so it has tracks to work with." />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0.12, 1] }}
                >
                  {/* ── Step 1: Feel ── */}
                  {step === 1 && (
                    <>
                      <div className="arch-section-label">{stepTitle}</div>

                      <div className="arch-field arch-nl">
                        <label className="ss-label">
                          <Sparkles
                            size={13}
                            strokeWidth={1.7}
                            style={{ verticalAlign: '-2px', marginRight: 5 }}
                          />
                          Describe it in words
                        </label>
                        <div className="arch-nl-row">
                          <input
                            className="arch-input"
                            placeholder="e.g. 2-hour peak club set, 126–130, build then sustain"
                            value={nlText}
                            onChange={(e) => setNlText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                applyNl()
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={applyNl}
                            disabled={nlText.trim() === ''}
                          >
                            Apply
                          </button>
                        </div>
                        {nlSummary && <span className="arch-nl-summary">{nlSummary}</span>}
                      </div>

                      <div className="arch-field">
                        <label className="ss-label">Vibe</label>
                        <div className="arch-chips">
                          {VIBES.map((v) => (
                            <Chip
                              key={v}
                              selected={params.vibe === v}
                              onClick={() => patch('vibe', v)}
                            >
                              {v}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div className="arch-row-2">
                        <div className="arch-field">
                          <label className="ss-label">Slot time</label>
                          <SegmentedControl
                            options={SLOT_TIMES}
                            value={params.slotTime as (typeof SLOT_TIMES)[number]}
                            onChange={(v) => patch('slotTime', v)}
                          />
                        </div>
                        <div className="arch-field">
                          <label className="ss-label">Crowd</label>
                          <SegmentedControl
                            options={CROWD_AGES}
                            value={params.crowdAge}
                            onChange={(v) => patch('crowdAge', v)}
                          />
                        </div>
                      </div>

                      <div className="arch-field">
                        <label className="ss-label">Venue</label>
                        <div className="arch-chips">
                          {VENUES.map((v) => (
                            <Chip
                              key={v}
                              selected={params.venueType === v}
                              onClick={() => patch('venueType', v)}
                            >
                              {v}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      {leafPlaylists.length > 0 && (
                        <div className="arch-field">
                          <div className="arch-field-header">
                            <label className="ss-label">Draw tracks from</label>
                            <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                              {sourcePoolSize.toLocaleString()} tracks
                            </span>
                          </div>
                          <PlaylistSourceDropdown
                            playlists={playlists}
                            selectedIds={selectedSourcePlaylistIds}
                            onChange={setSelectedSourcePlaylistIds}
                            totalCount={totalTracks}
                          />
                        </div>
                      )}

                      <div style={{ marginTop: 24 }}>
                        <Button
                          variant="primary"
                          icon={ArrowRight}
                          onClick={() => setStep(2)}
                          style={{ width: '100%' }}
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  )}

                  {/* ── Step 3: Result (Learn Mode) ── */}
                  {step === 3 && (
                    <>
                      <div className="arch-section-label">{stepTitle}</div>
                      <div className="ss-body-sm" style={{ marginBottom: 8, opacity: 0.75 }}>
                        Built a {resultTracks.length}-track set. Here&apos;s why this arrangement
                        works.
                      </div>
                      <LearnPanel
                        explanation={explainEnergyArc(
                          params.energyCurveType,
                          getTargetCurve(params.energyCurveType, resultTracks.length),
                          resultTracks
                        )}
                      />
                      <div className="arch-actions" style={{ marginTop: 20 }}>
                        <Button variant="primary" onClick={closeModal} style={{ flex: 1 }}>
                          View set
                        </Button>
                      </div>
                    </>
                  )}

                  {/* ── Step 2: Shape ── */}
                  {step === 2 && (
                    <>
                      <div className="arch-section-label">{stepTitle}</div>

                      {/* Set name */}
                      <div className="arch-field">
                        <label className="ss-label">Set name</label>
                        <input
                          className="arch-input"
                          placeholder={`${params.vibe} — ${params.slotTime}`}
                          value={setName}
                          onChange={(e) => setSetName(e.target.value)}
                        />
                      </div>

                      {/* Duration */}
                      <div className="arch-field">
                        <div className="arch-field-header">
                          <label className="ss-label">Duration</label>
                          <span className="ss-mono" style={{ fontSize: 12 }}>
                            {formatMinutes(params.targetDuration)}
                          </span>
                        </div>
                        <Slider
                          value={params.targetDuration}
                          min={30}
                          max={240}
                          step={15}
                          onChange={(v) => patch('targetDuration', v)}
                        />
                      </div>

                      {/* BPM range */}
                      <div className="arch-field">
                        <label className="ss-label">BPM range</label>
                        <RangeSlider
                          min={60}
                          max={200}
                          step={1}
                          low={params.bpmMin}
                          high={params.bpmMax}
                          onChange={(low, high) =>
                            setParams((p) => ({ ...p, bpmMin: low, bpmMax: high }))
                          }
                          formatLabel={(v) => `${v}`}
                        />
                      </div>

                      {/* Toggles row */}
                      <div className="arch-toggles">
                        <div className="arch-toggle-row">
                          <span className="ss-body-sm">Harmonic mixing</span>
                          <Toggle
                            on={params.harmonicMixing}
                            onChange={(v) => patch('harmonicMixing', v)}
                            aria-label="Harmonic mixing"
                          />
                        </div>
                        <div className="arch-toggle-row">
                          <span className="ss-body-sm">Follow energy curve</span>
                          <Toggle
                            on={params.followEnergyCurve}
                            onChange={(v) => patch('followEnergyCurve', v)}
                            aria-label="Follow energy curve"
                          />
                        </div>
                      </div>

                      {/* Energy curve type */}
                      {params.followEnergyCurve && (
                        <div className="arch-field" style={{ marginTop: 16 }}>
                          <label className="ss-label">Energy curve</label>
                          <SegmentedControl
                            options={CURVE_TYPES}
                            value={params.energyCurveType}
                            onChange={(v) => patch('energyCurveType', v)}
                          />
                        </div>
                      )}

                      {lockedFromTimeline.length > 0 && (
                        <div
                          className="ss-caption"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 12,
                            color: 'var(--accent)'
                          }}
                        >
                          <Lock size={11} strokeWidth={2} aria-hidden="true" />
                          <span>
                            {lockedFromTimeline.length} locked track
                            {lockedFromTimeline.length === 1 ? '' : 's'} will stay in place
                          </span>
                        </div>
                      )}

                      {buildError && (
                        <div
                          className="ss-caption"
                          style={{ color: 'var(--semantic-danger)', marginTop: 8 }}
                        >
                          {buildError}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="arch-actions">
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            setStep(1)
                            setBuildError(null)
                          }}
                        >
                          ← Back
                        </button>
                        {isBuilding ? (
                          <div className="arch-building">
                            <Loader size={15} strokeWidth={1.5} className="arch-spinner" />
                            <span className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                              Building…
                            </span>
                          </div>
                        ) : (
                          <Button variant="primary" onClick={handleBuild} style={{ flex: 1 }}>
                            Build set
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
