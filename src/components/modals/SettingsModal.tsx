import { useEffect, useState, useCallback, type KeyboardEvent } from 'react'
import { Eye, EyeOff, GraduationCap, X } from 'lucide-react'
import type { CDJModel } from '@/types'
import { Button } from '@/components/shared/Button'
import { Chip } from '@/components/shared/Chip'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Toggle } from '@/components/shared/Toggle'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useDiscoverStore } from '@/stores/discoverStore'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { DISCOVER_GENRES } from '@/data/discoverGenres'

const HARDWARE_OPTIONS: CDJModel[] = [
  'CDJ-2000NXS2',
  'CDJ-3000',
  'XDJ-RX3',
  'XDJ-XZ',
  'CDJ-2000',
]

function dedupeCaseInsensitive(list: string[], incoming: string): string[] {
  const lower = incoming.toLowerCase()
  if (list.some((x) => x.toLowerCase() === lower)) return list
  return [...list, incoming]
}

function splitPaste(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function SettingsModal(): React.JSX.Element {
  const { closeModal } = useUiStore()
  const setLearnModeEnabled = useUiStore((s) => s.setLearnModeEnabled)
  const loadTasteProfile = useDiscoverStore((s) => s.loadTasteProfile)

  const [targetHardware, setTargetHardware] = useState<CDJModel>('CDJ-2000NXS2')
  const [bpmLow, setBpmLow] = useState(120)
  const [bpmHigh, setBpmHigh] = useState(132)
  const [harmonicMixing, setHarmonicMixing] = useState(true)
  // Local state — consistent with all other toggles; persists on Save
  const [learnMode, setLearnMode] = useState(false)
  const [youtubeApiKey, setYoutubeApiKey] = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [favouriteArtists, setFavouriteArtists] = useState<string[]>([])
  const [favouriteGenres, setFavouriteGenres] = useState<string[]>([])
  const [followedDJs, setFollowedDJs] = useState<string[]>([])
  const [artistInput, setArtistInput] = useState('')
  const [djInput, setDjInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    window.setsense.getSettings().then((s) => {
      setTargetHardware(s.targetHardware)
      setBpmLow(s.defaultBpmMin)
      setBpmHigh(s.defaultBpmMax)
      setHarmonicMixing(s.harmonicMixingDefault)
      setLearnMode(s.learnModeEnabled ?? false)
      setYoutubeApiKey(s.youtubeApiKey ?? '')
      setFavouriteArtists(s.favouriteArtists ?? [])
      setFavouriteGenres(s.favouriteGenres ?? [])
      setFollowedDJs(s.followedDJs ?? [])
      setLoaded(true)
    })
  }, [])

  const toggleGenre = useCallback((g: string) => {
    setFavouriteGenres((cur) =>
      cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]
    )
  }, [])

  function commitTags(
    raw: string,
    setList: (updater: (cur: string[]) => string[]) => void,
    setInput: (v: string) => void,
  ): void {
    const parts = splitPaste(raw)
    if (parts.length === 0) {
      setInput('')
      return
    }
    setList((cur) => parts.reduce((acc, p) => dedupeCaseInsensitive(acc, p), cur))
    setInput('')
  }

  function tagInputKey(
    e: KeyboardEvent<HTMLInputElement>,
    value: string,
    list: string[],
    setList: (updater: (cur: string[]) => string[]) => void,
    setInput: (v: string) => void,
  ): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTags(value, setList, setInput)
    } else if (e.key === 'Backspace' && value === '' && list.length > 0) {
      e.preventDefault()
      setList((cur) => cur.slice(0, -1))
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    await window.setsense.setSettings({
      targetHardware,
      defaultBpmMin: bpmLow,
      defaultBpmMax: bpmHigh,
      harmonicMixingDefault: harmonicMixing,
      learnModeEnabled: learnMode,
      youtubeApiKey,
      favouriteArtists,
      favouriteGenres,
      followedDJs,
    })
    // Sync Learn Mode into the live UI store so changes take effect immediately
    setLearnModeEnabled(learnMode)
    await loadTasteProfile()
    setSaving(false)
    closeModal()
  }

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <motion.div
        className="modal glass-3 settings-modal"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ maxWidth: 480, width: '100%' }}
      >
        {/* Header — pinned above scroll */}
        <div className="modal-header">
          <div className="ss-h2">Settings</div>
          <IconButton icon={X} aria-label="Close settings" onClick={closeModal} />
        </div>

        {/* Scrollable body */}
        <div className="settings-scroll-body">
          {loaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 0 8px' }}>
              {/* Learn Mode */}
              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <GraduationCap size={18} strokeWidth={1.6} style={{ marginTop: 2, opacity: 0.8 }} aria-hidden="true" />
                    <div>
                      <div className="ss-label">Learn Mode</div>
                      <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                        Adds in-line explanations + diagrams to every recommendation. Great for picking up harmonic mixing, BPM transitions, and energy arcs.
                      </div>
                    </div>
                  </div>
                  <Toggle
                    on={learnMode}
                    onChange={setLearnMode}
                    aria-label="Toggle Learn Mode"
                  />
                </div>
              </div>

              {/* Target hardware */}
              <div className="field-group">
                <label className="ss-label">
                  <LearnTooltip
                    explanation={{
                      summary: 'Default target hardware',
                      detail: 'Sets the Pioneer CDJ model used during export validation — controls allowed file formats, max bitrate, hot-cue count, and folder layout. Pick the model your booth uses.',
                    }}
                    iconLabel="What is target hardware?"
                  >
                    Default target hardware
                  </LearnTooltip>
                </label>
                <div style={{ marginTop: 8 }}>
                  <SegmentedControl
                    options={HARDWARE_OPTIONS}
                    value={targetHardware}
                    onChange={(v) => setTargetHardware(v as CDJModel)}
                  />
                </div>
              </div>

              {/* Default BPM range */}
              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="ss-label">
                    <LearnTooltip
                      explanation={{
                        summary: 'Default BPM range',
                        detail: 'The tempo window Set Architect and Suggestions stay within. Narrower = more cohesive flow; wider = more candidate tracks. 8–10 BPM is a typical club range.',
                      }}
                      iconLabel="What is the BPM range?"
                    >
                      Default BPM range
                    </LearnTooltip>
                  </label>
                  <span className="ss-mono ss-caption" style={{ opacity: 0.7 }}>
                    {bpmLow}–{bpmHigh} BPM
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <RangeSlider
                    min={60}
                    max={200}
                    step={1}
                    low={bpmLow}
                    high={bpmHigh}
                    onChange={(low, high) => { setBpmLow(low); setBpmHigh(high) }}
                  />
                </div>
              </div>

              {/* YouTube API key */}
              <div className="field-group">
                <label className="ss-label" htmlFor="yt-api-key">YouTube API key</label>
                <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2, marginBottom: 8 }}>
                  Required for live DJ set discovery. Get a key at Google Cloud Console (YouTube Data API v3).
                </div>
                <div className="settings-api-key-row">
                  <input
                    id="yt-api-key"
                    type={apiKeyVisible ? 'text' : 'password'}
                    className="settings-api-key-input"
                    value={youtubeApiKey}
                    onChange={(e) => setYoutubeApiKey(e.target.value)}
                    placeholder="AIza…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="settings-api-key-toggle"
                    aria-label={apiKeyVisible ? 'Hide key' : 'Show key'}
                    onClick={() => setApiKeyVisible((v) => !v)}
                  >
                    {apiKeyVisible
                      ? <EyeOff size={15} strokeWidth={1.7} />
                      : <Eye size={15} strokeWidth={1.7} />}
                  </button>
                </div>
              </div>

              {/* Harmonic mixing default */}
              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="ss-label">
                      <LearnTooltip
                        explanation={{
                          summary: 'Harmonic mixing',
                          detail: 'When on, Set Architect prefers adjacent or same-letter Camelot keys, keeping the harmonic colour consistent and avoiding key clashes. Turn off if you intentionally want jarring key shifts.',
                        }}
                        iconLabel="What is harmonic mixing?"
                      >
                        Harmonic mixing
                      </LearnTooltip>
                    </div>
                    <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                      On by default in Set Architect
                    </div>
                  </div>
                  <Toggle on={harmonicMixing} onChange={setHarmonicMixing} />
                </div>
              </div>

              {/* Taste profile */}
              <div className="settings-section-header ss-caption" style={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 }}>
                Taste profile
              </div>

              {/* Favourite genres */}
              <div className="field-group">
                <label className="ss-label">Favourite genres</label>
                <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2, marginBottom: 8 }}>
                  Shapes recommendations and clarity badges in Discover.
                </div>
                <div className="settings-chip-grid">
                  {DISCOVER_GENRES.map((g) => (
                    <Chip key={g} selected={favouriteGenres.includes(g)} onClick={() => toggleGenre(g)}>
                      {g}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Favourite artists */}
              <div className="field-group">
                <label className="ss-label" htmlFor="settings-artist-input">Favourite artists</label>
                <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2, marginBottom: 8 }}>
                  Type a name and press Enter to add. Comma-paste to add several.
                </div>
                <div className="settings-tag-row">
                  {favouriteArtists.map((a) => (
                    <Chip key={a} className="settings-tag-chip">
                      <span>{a}</span>
                      <button
                        type="button"
                        className="settings-tag-remove"
                        aria-label={`Remove ${a}`}
                        onClick={() =>
                          setFavouriteArtists((cur) => cur.filter((x) => x !== a))
                        }
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </Chip>
                  ))}
                  <input
                    id="settings-artist-input"
                    type="text"
                    className="settings-tag-input"
                    value={artistInput}
                    placeholder={favouriteArtists.length === 0 ? 'e.g. Bicep, Four Tet' : ''}
                    onChange={(e) => setArtistInput(e.target.value)}
                    onKeyDown={(e) =>
                      tagInputKey(e, artistInput, favouriteArtists, setFavouriteArtists, setArtistInput)
                    }
                    onBlur={() => artistInput && commitTags(artistInput, setFavouriteArtists, setArtistInput)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Followed DJs */}
              <div className="field-group">
                <label className="ss-label" htmlFor="settings-dj-input">Followed DJs</label>
                <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2, marginBottom: 8 }}>
                  Sets by these DJs appear in the Following tab.
                </div>
                <div className="settings-tag-row">
                  {followedDJs.map((d) => (
                    <Chip key={d} className="settings-tag-chip">
                      <span>{d}</span>
                      <button
                        type="button"
                        className="settings-tag-remove"
                        aria-label={`Remove ${d}`}
                        onClick={() =>
                          setFollowedDJs((cur) => cur.filter((x) => x !== d))
                        }
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </Chip>
                  ))}
                  <input
                    id="settings-dj-input"
                    type="text"
                    className="settings-tag-input"
                    value={djInput}
                    placeholder={followedDJs.length === 0 ? 'e.g. Amelie Lens, Peggy Gou' : ''}
                    onChange={(e) => setDjInput(e.target.value)}
                    onKeyDown={(e) =>
                      tagInputKey(e, djInput, followedDJs, setFollowedDJs, setDjInput)
                    }
                    onBlur={() => djInput && commitTags(djInput, setFollowedDJs, setDjInput)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — pinned below scroll */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !loaded}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
