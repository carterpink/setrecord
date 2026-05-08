import { useState } from 'react'
import { ArrowRight, Loader, X } from 'lucide-react'
import type {
  ArchitectParams,
  EnergyCurveType,
  SetTrack,
  SetVibe,
  VenueType,
} from '@/types'
import { Button } from '@/components/shared/Button'
import { Chip } from '@/components/shared/Chip'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Slider } from '@/components/shared/Slider'
import { Toggle } from '@/components/shared/Toggle'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'

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
  energyCurveType: 'rise',
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
  const { populateFromArchitect } = useSetStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [params, setParams] = useState<ArchitectParams>(DEFAULT_PARAMS)
  const [setName, setSetName] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)

  function patch<K extends keyof ArchitectParams>(key: K, value: ArchitectParams[K]) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  async function handleBuild() {
    setIsBuilding(true)
    setBuildError(null)
    try {
      const [setTracks] = await Promise.all([
        window.setsense.buildSet(params) as Promise<SetTrack[]>,
        new Promise<void>((r) => setTimeout(r, 1000)),
      ])
      if (!setTracks || setTracks.length === 0) {
        setBuildError('No tracks matched — try widening the BPM range or duration.')
        setIsBuilding(false)
        return
      }
      populateFromArchitect(setTracks, params, setName.trim() || undefined)
      closeModal()
    } catch {
      setBuildError('Build failed. Try adjusting your BPM range or duration.')
      setIsBuilding(false)
    }
  }

  const stepTitle = step === 1 ? 'Set the feel' : 'Set the shape'
  const stepSubtitle = step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal glass-3"
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
            <span className="ss-caption" style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}>
              {stepSubtitle}
            </span>
          </div>
          <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
        </div>

        <div className="modal-body">
          {/* ── Step 1: Feel ── */}
          {step === 1 && (
            <>
              <div className="arch-section-label">{stepTitle}</div>

              <div className="arch-field">
                <label className="ss-label">Vibe</label>
                <div className="arch-chips">
                  {VIBES.map((v) => (
                    <Chip key={v} selected={params.vibe === v} onClick={() => patch('vibe', v)}>
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
                    value={params.slotTime as typeof SLOT_TIMES[number]}
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
                    <Chip key={v} selected={params.venueType === v} onClick={() => patch('venueType', v)}>
                      {v}
                    </Chip>
                  ))}
                </div>
              </div>

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
                  onChange={(low, high) => setParams((p) => ({ ...p, bpmMin: low, bpmMax: high }))}
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

              {buildError && (
                <div className="ss-caption" style={{ color: 'var(--semantic-danger)', marginTop: 8 }}>
                  {buildError}
                </div>
              )}

              {/* Actions */}
              <div className="arch-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => { setStep(1); setBuildError(null) }}
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
        </div>
      </div>
    </div>
  )
}
