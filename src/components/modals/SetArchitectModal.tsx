import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Copy, Loader, Lock, RefreshCw, Sparkles, X } from 'lucide-react'
import type {
  ArchitectParams,
  EnergyCurveType,
  GenreProfileInfo,
  SetTrack,
  SetVibe,
  VenueType
} from '@/types'
import { Button } from '@/components/shared/Button'
import { Chip } from '@/components/shared/Chip'
import { PlaylistSourceDropdown } from '@/components/shared/PlaylistSourceDropdown'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { Slider } from '@/components/shared/Slider'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { Modal } from '@/components/shared/Modal'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useRecallStore } from '@/stores/recallStore'
import { useUiStore } from '@/stores/uiStore'
import { LearnPanel } from '@/components/learn/LearnPanel'
import { explainEnergyArc } from '@/utils/learnMode/explanations'
import { getTargetCurve } from '@/utils/energyCurve'
import { parseArchitectQuery } from '@/utils/architectQuery'
import { decodeSeed, encodeSeed, freshSeed } from '@/utils/seed'

// Sensible hidden defaults for the parameters we no longer expose in the UI.
// The builder still reads them; we just don't make the DJ tune them.
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

// The energy-curve taxonomy is no longer a user control — we pick one smart
// shape from the chosen vibe. Keeps the engine + Learn Mode fully functional
// without asking the DJ to reason about curve types.
const CURVE_BY_VIBE: Record<SetVibe, EnergyCurveType> = {
  warmup: 'rise',
  club: 'rise',
  peak: 'peak-sustain',
  festival: 'peak-sustain',
  mixed: 'wave',
  underground: 'wave',
  closing: 'wave'
}

function deriveCurveType(vibe: SetVibe): EnergyCurveType {
  return CURVE_BY_VIBE[vibe] ?? 'rise'
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function SetArchitectModal(): React.JSX.Element {
  const { t } = useTranslation('modals')
  const { closeModal } = useUiStore()
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const { populateFromArchitect } = useSetStore()
  const gigs = useRecallStore((s) => s.gigs)
  const loadGigs = useRecallStore((s) => s.loadGigs)
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

  const [phase, setPhase] = useState<'form' | 'result'>('form')
  const [params, setParams] = useState<ArchitectParams>(DEFAULT_PARAMS)
  const [setName, setSetName] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [seedVenue, setSeedVenue] = useState('')
  const [venueHint, setVenueHint] = useState<string | null>(null)
  const [resultTracks, setResultTracks] = useState<SetTrack[]>([])
  // The exact params used for the most recent build — drives the Learn panel and
  // the eventual commit so the curve/vibe shown match what was generated.
  const [resultParams, setResultParams] = useState<ArchitectParams>(DEFAULT_PARAMS)
  /** Empty array = no constraint (use whole library). */
  const [selectedSourcePlaylistIds, setSelectedSourcePlaylistIds] = useState<string[]>([])

  // Genre mixing intelligence: the engine auto-detects the dominant style of the
  // source pool ("Auto"); the DJ can override it ("optimise for tech house").
  const [genreInfo, setGenreInfo] = useState<GenreProfileInfo | null>(null)
  /** null = Auto (let the engine detect); otherwise a manual profile id. */
  const [genreOverride, setGenreOverride] = useState<string | null>(null)
  /** The style blurb the most recent build actually used — drives the result copy. */
  const [resultBlurb, setResultBlurb] = useState('')

  // ── Seeded regeneration (FR-305) ──
  // Every build runs with a variation seed so it's reproducible. By default
  // Regenerate mints a fresh seed (a new take); when the seed is locked it
  // reuses the current one (reproduce). The seed itself lives quietly behind an
  // "Advanced" disclosure — pasteable to reproduce a shared or saved set.
  const [seedLocked, setSeedLocked] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seedDraft, setSeedDraft] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [seedCopied, setSeedCopied] = useState(false)

  // Refresh the detected default + selectable styles whenever the source pool
  // changes, so "Auto" always reflects the tracks being built from.
  useEffect(() => {
    let cancelled = false
    window.setrecord
      .genreProfiles(selectedSourcePlaylistIds)
      .then((info) => {
        if (!cancelled) setGenreInfo(info)
      })
      .catch(() => {
        /* leave genreInfo null — the field simply hides */
      })
    return () => {
      cancelled = true
    }
  }, [selectedSourcePlaylistIds])

  // Manual override genres (everything except the generic "Auto" entry).
  const overrideProfiles = useMemo(
    () => (genreInfo?.profiles ?? []).filter((p) => p.id !== 'generic'),
    [genreInfo]
  )

  // Resolve the blurb for the currently selected style (for the result copy).
  function resolveBlurb(): string {
    if (genreOverride) {
      return (
        genreInfo?.profiles.find((p) => p.id === genreOverride)?.blurb ??
        t('architect.balancedFlow')
      )
    }
    return genreInfo?.detected.blurb ?? t('architect.balancedFlow')
  }

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

  // ── "Start from a venue": tune generation to a room from the Brief ─────────
  useEffect(() => {
    void loadGigs()
  }, [loadGigs])
  const venues = useMemo(() => {
    const m = new Map<string, { venue: string; eventType?: VenueType }>()
    for (const g of gigs) {
      const v = g.venue?.trim()
      if (v && !m.has(v.toLowerCase())) m.set(v.toLowerCase(), { venue: v, eventType: g.eventType })
    }
    return Array.from(m.values())
  }, [gigs])
  async function pickVenue(venue: string): Promise<void> {
    setSeedVenue(venue)
    setVenueHint(null)
    if (!venue) return
    const meta = venues.find((v) => v.venue === venue)
    try {
      const brief = await window.setrecord.historyBrief(venue, meta?.eventType)
      setParams((p) => ({
        ...p,
        venueType: meta?.eventType ?? p.venueType,
        bpmMin: brief.profile?.bpmLow ?? p.bpmMin,
        bpmMax: brief.profile?.bpmHigh ?? p.bpmMax
      }))
      setVenueHint(brief.timesPlayed > 0 ? brief.narration : null)
    } catch {
      setVenueHint(null)
    }
  }

  // Natural-language brief → params (same deterministic tech as Library conversations).
  const [nlText, setNlText] = useState('')
  const [nlSummary, setNlSummary] = useState('')
  function applyNl(): void {
    const { params: parsed, summary } = parseArchitectQuery(nlText)
    if (Object.keys(parsed).length === 0) {
      setNlSummary(t('architect.nlNoMatch'))
      return
    }
    setParams((p) => ({ ...p, ...parsed }))
    setNlSummary(t('architect.nlApplied', { summary }))
  }

  // Build (or regenerate) a set. Every build runs with a variation seed so the
  // result is reproducible. By default each call mints a fresh seed → "one
  // possible set" (variation is the feature). Reproduce by passing an explicit
  // seed (paste) or by locking the current one. We do NOT commit to the sidebar
  // here; that happens only on "Use this set".
  async function runBuild(seedOverride?: number): Promise<void> {
    // Resolve the seed: explicit override > locked (reuse) > fresh (vary).
    const variationSeed =
      seedOverride !== undefined
        ? seedOverride
        : seedLocked && resultParams.variationSeed !== undefined
          ? resultParams.variationSeed
          : freshSeed()
    setIsBuilding(true)
    setBuildError(null)
    try {
      const lockedTracks = lockedFromTimeline.map((t) => ({
        position: t.position,
        trackId: t.trackId
      }))
      const paramsForBuild: ArchitectParams = {
        ...params,
        energyCurveType: deriveCurveType(params.vibe),
        variationSeed,
        ...(selectedSourcePlaylistIds.length > 0
          ? { sourcePlaylistIds: selectedSourcePlaylistIds }
          : {}),
        ...(genreOverride ? { genreProfileId: genreOverride } : {}),
        ...(lockedTracks.length > 0 ? { lockedTracks } : {})
      }
      const [setTracks] = await Promise.all([
        window.setrecord.buildSet(paramsForBuild) as Promise<SetTrack[]>,
        new Promise<void>((r) => setTimeout(r, 700))
      ])
      if (!setTracks || setTracks.length === 0) {
        setBuildError(t('architect.noTracksMatched'))
        setIsBuilding(false)
        return
      }
      setResultTracks(setTracks)
      setResultParams(paramsForBuild)
      setResultBlurb(resolveBlurb())
      setPhase('result')
      setIsBuilding(false)
    } catch {
      setBuildError(t('architect.buildFailed'))
      setIsBuilding(false)
    }
  }

  // Copy the current set's seed (base36) to the clipboard for sharing/reproducing.
  function copySeed(): void {
    if (resultParams.variationSeed === undefined) return
    navigator.clipboard?.writeText(encodeSeed(resultParams.variationSeed)).then(
      () => {
        setSeedCopied(true)
        window.setTimeout(() => setSeedCopied(false), 1500)
      },
      () => {
        /* clipboard blocked — silently no-op */
      }
    )
  }

  // Rebuild from a pasted seed, reproducing a shared or saved set. Locks the
  // seed so a follow-up Regenerate keeps reproducing rather than varying.
  function reproduceFromSeed(): void {
    const decoded = decodeSeed(seedDraft)
    if (decoded === null) {
      setSeedError(true)
      return
    }
    setSeedError(false)
    setSeedDraft('')
    setSeedLocked(true)
    void runBuild(decoded)
  }

  // Commit the previewed set to the timeline + sidebar, then close.
  function useThisSet(): void {
    populateFromArchitect(resultTracks, resultParams, setName.trim() || undefined)
    closeModal()
  }

  const subtitle = phase === 'form' ? t('architect.subtitleForm') : t('architect.subtitleResult')

  return (
    <Modal
      onClose={closeModal}
      ariaLabel="Set Architect"
      maxWidth={520}
      bloom={{ icon: 'layers', tone: 'cyan' }}
    >
      {/* Header */}
      <div className="modal-header">
        <div>
          <span className="ss-h2">Set Architect</span>
          <span className="ss-caption" style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}>
            {subtitle}
          </span>
        </div>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
      </div>

      <div className="modal-body">
        {totalTracks === 0 ? (
          <NoLibraryState body={t('architect.noLibraryBody')} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0.12, 1] }}
            >
              {/* ── Form ── */}
              {phase === 'form' && (
                <>
                  <div className="arch-field arch-nl">
                    <label className="ss-label">
                      <Sparkles
                        size={13}
                        strokeWidth={1.7}
                        style={{ verticalAlign: '-2px', marginRight: 5 }}
                      />
                      {t('architect.describeLabel')}
                    </label>
                    <div className="arch-nl-row">
                      <input
                        className="arch-input"
                        placeholder={t('architect.describePlaceholder')}
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
                        {t('architect.apply')}
                      </button>
                    </div>
                    {nlSummary && <span className="arch-nl-summary">{nlSummary}</span>}
                  </div>

                  {venues.length > 0 && (
                    <div className="arch-field">
                      <label className="ss-label" htmlFor="arch-venue-seed">
                        Start from a venue
                      </label>
                      <select
                        id="arch-venue-seed"
                        className="arch-input"
                        value={seedVenue}
                        onChange={(e) => void pickVenue(e.target.value)}
                      >
                        <option value="">No venue — start fresh</option>
                        {venues.map((v) => (
                          <option key={v.venue} value={v.venue}>
                            {v.venue}
                          </option>
                        ))}
                      </select>
                      {venueHint && <span className="arch-nl-summary">{venueHint}</span>}
                    </div>
                  )}
                  <div className="arch-field">
                    <label className="ss-label">{t('architect.setName')}</label>
                    <input
                      className="arch-input"
                      placeholder={t('architect.setNamePlaceholder', {
                        vibe: t(`architect.vibe.${params.vibe}`)
                      })}
                      value={setName}
                      onChange={(e) => setSetName(e.target.value)}
                    />
                  </div>

                  <div className="arch-field">
                    <label className="ss-label">{t('architect.vibeLabel')}</label>
                    <div className="arch-chips">
                      {VIBES.map((v) => (
                        <Chip key={v} selected={params.vibe === v} onClick={() => patch('vibe', v)}>
                          {t(`architect.vibe.${v}`)}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="arch-field">
                    <div className="arch-field-header">
                      <label className="ss-label">{t('architect.duration')}</label>
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

                  {genreInfo && overrideProfiles.length > 0 && (
                    <div className="arch-field">
                      <label className="ss-label">{t('architect.optimiseFor')}</label>
                      <div className="arch-chips">
                        <Chip
                          selected={genreOverride === null}
                          onClick={() => setGenreOverride(null)}
                        >
                          {genreInfo.detected.id !== 'generic'
                            ? t('architect.autoDetected', { label: genreInfo.detected.label })
                            : t('architect.auto')}
                        </Chip>
                        {overrideProfiles.map((p) => (
                          <Chip
                            key={p.id}
                            selected={genreOverride === p.id}
                            onClick={() => setGenreOverride(p.id)}
                          >
                            {p.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="arch-field">
                    <label className="ss-label">{t('architect.bpmRange')}</label>
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

                  {leafPlaylists.length > 0 && (
                    <div className="arch-field">
                      <div className="arch-field-header">
                        <label className="ss-label">{t('architect.drawFrom')}</label>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          {t('architect.tracksCount', {
                            count: sourcePoolSize,
                            formatted: sourcePoolSize.toLocaleString()
                          })}
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
                      <span>{t('architect.lockedNote', { count: lockedFromTimeline.length })}</span>
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

                  <div style={{ marginTop: 24 }}>
                    {isBuilding ? (
                      <div className="arch-building" style={{ justifyContent: 'center' }}>
                        <Loader size={15} strokeWidth={1.5} className="arch-spinner" />
                        <span className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                          {t('architect.building')}
                        </span>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        icon={Sparkles}
                        onClick={() => runBuild()}
                        style={{ width: '100%' }}
                      >
                        {t('architect.buildSet')}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* ── Result ── */}
              {phase === 'result' && (
                <>
                  <div className="ss-body-sm" style={{ marginBottom: 12, opacity: 0.8 }}>
                    {t('architect.resultIntro', { count: resultTracks.length })}
                  </div>

                  {resultBlurb && (
                    <div
                      className="ss-caption"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 12,
                        color: 'var(--accent)'
                      }}
                    >
                      <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
                      <span>{t('architect.followsBlurb', { blurb: resultBlurb })}</span>
                    </div>
                  )}

                  <ol className="arch-result-list">
                    {resultTracks.map((st, i) => (
                      <li key={st.id} className="arch-result-row">
                        <span className="arch-result-pos ss-mono">{i + 1}</span>
                        <span className="arch-result-meta">
                          <span className="arch-result-title">
                            {st.track.title}
                            {st.locked && (
                              <Lock
                                size={10}
                                strokeWidth={2}
                                style={{
                                  marginLeft: 6,
                                  verticalAlign: '-1px',
                                  color: 'var(--accent)'
                                }}
                                aria-label={t('architect.lockedAria')}
                              />
                            )}
                          </span>
                          <span className="arch-result-artist">{st.track.artist}</span>
                        </span>
                        <span className="arch-result-bpm ss-mono">{Math.round(st.track.bpm)}</span>
                      </li>
                    ))}
                  </ol>

                  {learnModeEnabled && (
                    <div style={{ marginTop: 14 }}>
                      <LearnPanel
                        explanation={explainEnergyArc(
                          resultParams.energyCurveType,
                          getTargetCurve(resultParams.energyCurveType, resultTracks.length),
                          resultTracks
                        )}
                      />
                    </div>
                  )}

                  <div className="arch-actions" style={{ marginTop: 18 }}>
                    <Button
                      variant="secondary"
                      icon={isBuilding ? undefined : seedLocked ? Lock : RefreshCw}
                      onClick={() => runBuild()}
                      disabled={isBuilding}
                      title={
                        seedLocked ? t('architect.seedLockedTitle') : t('architect.regenerateTitle')
                      }
                    >
                      {isBuilding
                        ? seedLocked
                          ? t('architect.reproducing')
                          : t('architect.regenerating')
                        : seedLocked
                          ? t('architect.reproduce')
                          : t('architect.regenerate')}
                    </Button>
                    <Button variant="primary" onClick={useThisSet} style={{ flex: 1 }}>
                      {t('architect.useThisSet')}
                    </Button>
                  </div>

                  {/* Advanced — seed visibility & reproduction (hidden by default). */}
                  <div
                    style={{
                      marginTop: 16,
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 12
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      aria-expanded={showAdvanced}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        font: 'inherit'
                      }}
                    >
                      <ChevronDown
                        size={13}
                        strokeWidth={2}
                        aria-hidden="true"
                        style={{
                          transform: showAdvanced ? 'none' : 'rotate(-90deg)',
                          transition: 'transform 0.15s ease'
                        }}
                      />
                      <span className="ss-caption">{t('architect.advanced')}</span>
                    </button>

                    {showAdvanced && (
                      <div
                        style={{
                          marginTop: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        {resultParams.variationSeed !== undefined && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                              {t('architect.seed')}
                            </span>
                            <code className="ss-mono" style={{ fontSize: 13 }}>
                              {encodeSeed(resultParams.variationSeed)}
                            </code>
                            <IconButton
                              icon={seedCopied ? Check : Copy}
                              size="sm"
                              aria-label={
                                seedCopied ? t('architect.seedCopied') : t('architect.copySeed')
                              }
                              onClick={copySeed}
                            />
                          </div>
                        )}

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={seedLocked}
                            onChange={(e) => setSeedLocked(e.target.checked)}
                          />
                          <span className="ss-caption">{t('architect.lockSeed')}</span>
                        </label>

                        <div className="arch-nl-row">
                          <input
                            className="arch-input"
                            placeholder={t('architect.pasteSeedPlaceholder')}
                            value={seedDraft}
                            onChange={(e) => {
                              setSeedDraft(e.target.value)
                              setSeedError(false)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                reproduceFromSeed()
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={reproduceFromSeed}
                            disabled={seedDraft.trim() === '' || isBuilding}
                          >
                            {t('architect.reproduce')}
                          </button>
                        </div>
                        {seedError && (
                          <span className="ss-caption" style={{ color: 'var(--semantic-danger)' }}>
                            {t('architect.invalidSeed')}
                          </span>
                        )}
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          {t('architect.seedHint')}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Modal>
  )
}
