import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, ChevronDown, Check, Plus, Minus, RefreshCw } from 'lucide-react'
import type { LibrarySearchParams } from '@/types'
import { readSummary, type HomeFilters } from '@/utils/homeQuery'

interface InterpretProps {
  filters: HomeFilters
  onRerun: (filters: HomeFilters) => void
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="refine-field">
      <span className="lbl">{label}</span>
      {children}
    </div>
  )
}

function Pill({
  on,
  onClick,
  children
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button type="button" className={`fpill${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}): React.JSX.Element {
  const { t } = useTranslation('home')
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={t('stepper.fewerAria')}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <span className="val">{value}</span>
      <button
        type="button"
        aria-label={t('stepper.moreAria')}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}

/** Which energy preset the generic params currently express. */
function energyPreset(p: LibrarySearchParams): 'Any' | 'Chill' | 'Groovy' | 'Peak' {
  if (p.energyMin != null && p.energyMin >= 8) return 'Peak'
  if (p.energyMax != null && p.energyMax <= 4 && p.energyMin == null) return 'Chill'
  if (p.energyMin === 4 && p.energyMax === 6) return 'Groovy'
  return 'Any'
}

function applyEnergy(p: LibrarySearchParams, preset: string): LibrarySearchParams {
  const next = { ...p }
  delete next.energyMin
  delete next.energyMax
  if (preset === 'Chill') next.energyMax = 4
  else if (preset === 'Groovy') {
    next.energyMin = 4
    next.energyMax = 6
  } else if (preset === 'Peak') next.energyMin = 8
  return next
}

const SORT_PILLS: { labelKey: string; value: LibrarySearchParams['sort'] }[] = [
  { labelKey: 'interpret.sort.mostPlayed', value: 'mostPlayed' },
  { labelKey: 'interpret.sort.newest', value: 'recent' },
  { labelKey: 'interpret.sort.topRated', value: 'rating' },
  { labelKey: 'interpret.sort.surprise', value: 'random' }
]

/**
 * The quiet, editable interpretation line — the two-tier-trust fix. Shows how
 * the request was read; opening it reveals the levers that actually drive the
 * result, and "Update" re-runs the real query in place.
 */
export function Interpret({ filters, onRerun }: InterpretProps): React.JSX.Element {
  const { t } = useTranslation('home')
  const [open, setOpen] = useState(false)
  // Draft is seeded from the incoming filters. The parent remounts this
  // component (keyed on the turn's summary) whenever a re-run changes the
  // filters, so there's no need to sync state in an effect.
  const [draft, setDraft] = useState<HomeFilters>(filters)

  function update(): void {
    onRerun(draft)
    setOpen(false)
  }

  // The model path has no editable levers — just a calm note.
  const editable = !(draft.kind === 'generic' && draft.ask)

  return (
    <div className="interpret">
      <div
        className={`interpret-line${open ? ' open' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          } else if (e.key === 'Escape' && open) {
            setOpen(false)
          }
        }}
      >
        <span className="lead">{t('interpret.lead')}</span>
        <span className="read" aria-live="polite" aria-atomic="true">
          {readSummary(draft)}
        </span>
        {editable && (
          <span className="refine">
            <Pencil size={13} strokeWidth={1.7} />
            {t('interpret.refine')}
          </span>
        )}
        <ChevronDown className="chev" size={14} strokeWidth={1.7} />
      </div>

      {open && (
        <div className="refine-panel glass-2">
          {!editable ? (
            <span className="note">{t('interpret.modelNote')}</span>
          ) : (
            <>
              <div className="refine-grid">
                {draft.kind === 'forgotten' && (
                  <>
                    <Field label={t('interpret.fields.notPlayedIn')}>
                      <div className="refine-pills">
                        {(['3 months', '6 months', '12 months'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={draft.window === o}
                            onClick={() => setDraft({ ...draft, window: o })}
                          >
                            {t(`interpret.window.${o}`)}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.neverPlayedLive')}>
                      <Pill
                        on={draft.neverLive}
                        onClick={() => setDraft({ ...draft, neverLive: !draft.neverLive })}
                      >
                        {draft.neverLive ? (
                          <Check size={13} strokeWidth={2} />
                        ) : (
                          <Plus size={13} strokeWidth={2} />
                        )}
                        {draft.neverLive ? t('interpret.toggle.on') : t('interpret.toggle.off')}
                      </Pill>
                    </Field>
                    <Field label={t('interpret.fields.howMany')}>
                      <Stepper
                        value={draft.count}
                        min={5}
                        max={25}
                        step={5}
                        onChange={(v) => setDraft({ ...draft, count: v })}
                      />
                    </Field>
                  </>
                )}

                {draft.kind === 'warmup' && (
                  <>
                    <Field label={t('interpret.fields.buildsToward')}>
                      <div className="refine-pills">
                        {[120, 124, 128].map((o) => (
                          <Pill
                            key={o}
                            on={draft.bpm === o}
                            onClick={() => setDraft({ ...draft, bpm: o })}
                          >
                            <span className="mono">{o}</span>
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.length')}>
                      <div className="refine-pills">
                        {[60, 90, 120].map((o) => (
                          <Pill
                            key={o}
                            on={draft.length === o}
                            onClick={() => setDraft({ ...draft, length: o })}
                          >
                            {t('interpret.lengthValue', { count: o })}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.shape')}>
                      <div className="refine-pills">
                        {(['Slow burn', 'Steady'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={draft.shape === o}
                            onClick={() => setDraft({ ...draft, shape: o })}
                          >
                            {o === 'Slow burn'
                              ? t('interpret.shape.slowBurn')
                              : t('interpret.shape.steady')}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                  </>
                )}

                {draft.kind === 'after' && (
                  <>
                    <Field label={t('interpret.fields.mixingOutOf')}>
                      <span className="fpill on">{draft.source}</span>
                    </Field>
                    <Field label={t('interpret.fields.keepInKey')}>
                      <Pill
                        on={draft.inKey}
                        onClick={() => setDraft({ ...draft, inKey: !draft.inKey })}
                      >
                        {draft.inKey ? (
                          <Check size={13} strokeWidth={2} />
                        ) : (
                          <Plus size={13} strokeWidth={2} />
                        )}
                        {t('interpret.harmonicOnly')}
                      </Pill>
                    </Field>
                    <Field label={t('interpret.fields.energy')}>
                      <div className="refine-pills">
                        {(['Hold', 'Lift'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={draft.energy === o}
                            onClick={() => setDraft({ ...draft, energy: o })}
                          >
                            {o === 'Hold'
                              ? t('interpret.energyPreset.hold')
                              : t('interpret.energyPreset.lift')}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                  </>
                )}

                {draft.kind === 'duplicates' && (
                  <>
                    <Field label={t('interpret.fields.matchOn')}>
                      <div className="refine-pills">
                        {(['Audio', 'Tags'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={draft.match === o}
                            onClick={() => setDraft({ ...draft, match: o })}
                          >
                            {o === 'Audio' ? t('interpret.match.audio') : t('interpret.match.tags')}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.keep')}>
                      <div className="refine-pills">
                        {(['Highest quality', 'Newest'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={draft.keep === o}
                            onClick={() => setDraft({ ...draft, keep: o })}
                          >
                            {o === 'Highest quality'
                              ? t('interpret.keepOption.highestQuality')
                              : t('interpret.keepOption.newest')}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                  </>
                )}

                {draft.kind === 'generic' && !draft.ask && (
                  <>
                    <Field label={t('interpret.fields.energy')}>
                      <div className="refine-pills">
                        {(['Any', 'Chill', 'Groovy', 'Peak'] as const).map((o) => (
                          <Pill
                            key={o}
                            on={energyPreset(draft.params) === o}
                            onClick={() =>
                              setDraft({ ...draft, params: applyEnergy(draft.params, o) })
                            }
                          >
                            {t(`interpret.energyLevel.${o.toLowerCase()}`)}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.orderBy')}>
                      <div className="refine-pills">
                        {SORT_PILLS.map((s) => (
                          <Pill
                            key={s.value}
                            on={(draft.params.sort ?? 'mostPlayed') === s.value}
                            onClick={() =>
                              setDraft({ ...draft, params: { ...draft.params, sort: s.value } })
                            }
                          >
                            {t(s.labelKey)}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('interpret.fields.howMany')}>
                      <Stepper
                        value={draft.params.limit ?? 25}
                        min={5}
                        max={50}
                        step={5}
                        onChange={(v) =>
                          setDraft({ ...draft, params: { ...draft.params, limit: v } })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>

              <div className="refine-foot">
                <span className="note">{t('interpret.footNote')}</span>
                <button type="button" className="btn btn-secondary" onClick={update}>
                  <RefreshCw size={14} strokeWidth={1.7} />
                  {t('interpret.update')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
