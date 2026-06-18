import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Plus, Trash2, Layers, FlaskConical, ChevronDown, ChevronRight } from 'lucide-react'
import type { CrateRule, CrateWithCount, SmartCrate, AudioFormat, Track } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { RecallTrackLine } from './RecallTrackLine'
import { formatCrateRules, formatCrateRuleLines } from '@/utils/crateLabels'

type RuleType =
  | 'bpm'
  | 'energy'
  | 'genre'
  | 'neverPlayed'
  | 'rating'
  | 'dormant'
  | 'key'
  | 'keyCompat'
  | 'format'
  | 'missingMeta'
  | 'duration'
  | 'playCount'

interface BuilderRule {
  type: RuleType
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  genreIncludes?: string
  ratingMin?: number
  lastPlayedOlderThanMonths?: number
  keyExact?: string
  keyCompatibleWith?: string
  format?: AudioFormat
  durationMinMin?: number // minutes
  durationMaxMin?: number
  playCountOp?: CrateRule['playCountOp']
  playCountValue?: number
}

const RULE_TYPES: RuleType[] = [
  'bpm',
  'energy',
  'genre',
  'neverPlayed',
  'rating',
  'dormant',
  'key',
  'keyCompat',
  'format',
  'missingMeta',
  'duration',
  'playCount'
]

const CAMELOT_KEYS: string[] = (() => {
  const out: string[] = []
  for (let n = 1; n <= 12; n++) {
    out.push(`${n}A`)
    out.push(`${n}B`)
  }
  return out
})()

const FORMATS: AudioFormat[] = ['mp3', 'aiff', 'wav', 'flac', 'm4a']

const PLAY_COUNT_OPS: Array<{ value: NonNullable<CrateRule['playCountOp']>; label: string }> = [
  { value: 'gte', label: '≥' },
  { value: 'gt', label: '>' },
  { value: 'eq', label: '=' },
  { value: 'lte', label: '≤' },
  { value: 'lt', label: '<' }
]

function builderRuleToCrateRule(r: BuilderRule): CrateRule {
  switch (r.type) {
    case 'bpm':
      return { bpmMin: r.bpmMin, bpmMax: r.bpmMax }
    case 'energy':
      return { energyMin: r.energyMin, energyMax: r.energyMax }
    case 'genre':
      return { genreIncludes: r.genreIncludes }
    case 'neverPlayed':
      return { neverPlayed: true }
    case 'rating':
      return { ratingMin: r.ratingMin }
    case 'dormant':
      return { lastPlayedOlderThanMonths: r.lastPlayedOlderThanMonths }
    case 'key':
      return { keyExact: r.keyExact }
    case 'keyCompat':
      return { keyCompatibleWith: r.keyCompatibleWith }
    case 'format':
      return { format: r.format }
    case 'missingMeta':
      return { missingMetadata: true }
    case 'duration':
      return {
        durationMinSec: r.durationMinMin != null ? r.durationMinMin * 60 : undefined,
        durationMaxSec: r.durationMaxMin != null ? r.durationMaxMin * 60 : undefined
      }
    case 'playCount':
      return { playCountOp: r.playCountOp ?? 'gte', playCountValue: r.playCountValue }
  }
}

/** Empty input → undefined (not 0), so clearing a field removes the constraint. */
function numOrUndef(v: string): number | undefined {
  return v.trim() === '' ? undefined : Number(v)
}

const MAX_RENDER = 150

function CrateBuilder({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation('recall')
  const saveCrate = useRecallStore((s) => s.saveCrate)
  const [name, setName] = useState('')
  const [match, setMatch] = useState<'all' | 'any'>('all')
  const [rules, setRules] = useState<BuilderRule[]>([{ type: 'bpm', bpmMin: 124, bpmMax: 130 }])

  const updateRule = (i: number, patch: Partial<BuilderRule>): void =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const save = async (): Promise<void> => {
    const crate: SmartCrate = {
      id: crypto.randomUUID(),
      name: name.trim() || t('crates.builder.untitledName'),
      match,
      rules: rules.map(builderRuleToCrateRule)
    }
    await saveCrate(crate)
    onClose()
  }

  return (
    <div className="recall-builder glass-2">
      <input
        className="recall-builder-name"
        placeholder={t('crates.builder.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="recall-builder-match">
        {t('crates.builder.matchLabel')}
        <select value={match} onChange={(e) => setMatch(e.target.value as 'all' | 'any')}>
          <option value="all">{t('crates.builder.matchAll')}</option>
          <option value="any">{t('crates.builder.matchAny')}</option>
        </select>
        {t('crates.builder.matchSuffix')}
      </div>

      {rules.map((rule, i) => (
        <div className="recall-builder-rule" key={i}>
          <select
            value={rule.type}
            onChange={(e) => updateRule(i, { type: e.target.value as RuleType })}
          >
            {RULE_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {t(`crates.ruleLabels.${rt}`)}
              </option>
            ))}
          </select>

          {rule.type === 'bpm' && (
            <>
              <input
                type="number"
                value={rule.bpmMin ?? ''}
                placeholder={t('crates.builder.placeholders.min')}
                onChange={(e) => updateRule(i, { bpmMin: numOrUndef(e.target.value) })}
              />
              <input
                type="number"
                value={rule.bpmMax ?? ''}
                placeholder={t('crates.builder.placeholders.max')}
                onChange={(e) => updateRule(i, { bpmMax: numOrUndef(e.target.value) })}
              />
            </>
          )}
          {rule.type === 'energy' && (
            <>
              <input
                type="number"
                min={1}
                max={10}
                value={rule.energyMin ?? ''}
                placeholder={t('crates.builder.placeholders.min')}
                onChange={(e) => updateRule(i, { energyMin: numOrUndef(e.target.value) })}
              />
              <input
                type="number"
                min={1}
                max={10}
                value={rule.energyMax ?? ''}
                placeholder={t('crates.builder.placeholders.max')}
                onChange={(e) => updateRule(i, { energyMax: numOrUndef(e.target.value) })}
              />
            </>
          )}
          {rule.type === 'genre' && (
            <input
              type="text"
              value={rule.genreIncludes ?? ''}
              placeholder={t('crates.builder.placeholders.genre')}
              onChange={(e) => updateRule(i, { genreIncludes: e.target.value })}
            />
          )}
          {rule.type === 'rating' && (
            <input
              type="number"
              min={0}
              max={5}
              value={rule.ratingMin ?? ''}
              placeholder={t('crates.builder.placeholders.stars')}
              onChange={(e) => updateRule(i, { ratingMin: numOrUndef(e.target.value) })}
            />
          )}
          {rule.type === 'dormant' && (
            <input
              type="number"
              min={1}
              value={rule.lastPlayedOlderThanMonths ?? ''}
              placeholder={t('crates.builder.placeholders.months')}
              onChange={(e) =>
                updateRule(i, { lastPlayedOlderThanMonths: numOrUndef(e.target.value) })
              }
            />
          )}
          {rule.type === 'key' && (
            <select
              value={rule.keyExact ?? ''}
              onChange={(e) => updateRule(i, { keyExact: e.target.value || undefined })}
            >
              <option value="">{t('crates.builder.pickPlaceholder')}</option>
              {CAMELOT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
          {rule.type === 'keyCompat' && (
            <select
              value={rule.keyCompatibleWith ?? ''}
              onChange={(e) => updateRule(i, { keyCompatibleWith: e.target.value || undefined })}
            >
              <option value="">{t('crates.builder.pickPlaceholder')}</option>
              {CAMELOT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
          {rule.type === 'format' && (
            <select
              value={rule.format ?? ''}
              onChange={(e) =>
                updateRule(i, { format: (e.target.value || undefined) as AudioFormat | undefined })
              }
            >
              <option value="">{t('crates.builder.pickPlaceholder')}</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
          {rule.type === 'duration' && (
            <>
              <input
                type="number"
                min={0}
                value={rule.durationMinMin ?? ''}
                placeholder={t('crates.builder.placeholders.min')}
                onChange={(e) => updateRule(i, { durationMinMin: numOrUndef(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                value={rule.durationMaxMin ?? ''}
                placeholder={t('crates.builder.placeholders.max')}
                onChange={(e) => updateRule(i, { durationMaxMin: numOrUndef(e.target.value) })}
              />
            </>
          )}
          {rule.type === 'playCount' && (
            <>
              <select
                value={rule.playCountOp ?? 'gte'}
                onChange={(e) =>
                  updateRule(i, { playCountOp: e.target.value as CrateRule['playCountOp'] })
                }
              >
                {PLAY_COUNT_OPS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={rule.playCountValue ?? ''}
                placeholder={t('crates.builder.placeholders.count')}
                onChange={(e) => updateRule(i, { playCountValue: numOrUndef(e.target.value) })}
              />
            </>
          )}
          {/* missingMeta and neverPlayed have no value input */}

          <button
            type="button"
            className="recall-icon-btn"
            title={t('crates.builder.removeRule')}
            onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className="recall-add-rule"
        onClick={() => setRules((rs) => [...rs, { type: 'energy', energyMin: 8, energyMax: 10 }])}
      >
        <Plus size={14} strokeWidth={1.5} /> {t('crates.builder.addRule')}
      </button>

      <div className="recall-builder-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t('crates.builder.cancel')}
        </button>
        <button type="button" className="btn-primary" onClick={() => void save()}>
          {t('crates.builder.save')}
        </button>
      </div>
    </div>
  )
}

export function CratesSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const crates = useRecallStore((s) => s.crates)
  const loading = useRecallStore((s) => s.cratesLoading)
  const loadCrates = useRecallStore((s) => s.loadCrates)
  const selectCrate = useRecallStore((s) => s.selectCrate)
  const selected = useRecallStore((s) => s.selectedCrate)
  const selectedLoading = useRecallStore((s) => s.selectedCrateLoading)
  const deleteCrate = useRecallStore((s) => s.deleteCrate)
  const flaggedTracks = useRecallStore((s) => s.flaggedTracks)
  const loadFlagged = useRecallStore((s) => s.loadFlagged)
  const flagForGig = useRecallStore((s) => s.flagForGig)
  const [building, setBuilding] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    void loadCrates()
    void loadFlagged()
  }, [loadCrates, loadFlagged])

  // Reset local selection state when the user picks a different crate.
  // (React canonical "reset on prop change" pattern via render-time comparison.)
  const lastSelectedId = useRef<string | null>(selected?.crate.id ?? null)
  if (lastSelectedId.current !== (selected?.crate.id ?? null)) {
    lastSelectedId.current = selected?.crate.id ?? null
    if (checked.size > 0) setChecked(new Set())
    if (rulesOpen) setRulesOpen(false)
  }

  const isUntestedCrate = selected?.crate.id === 'never-tested-live'

  const toggleCheck = (id: string): void => {
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFlag = async (): Promise<void> => {
    if (checked.size === 0) return
    await flagForGig(Array.from(checked))
    setChecked(new Set())
    // Refresh the crate so flagged tracks drop out of "Never tested live"
    if (selected) void selectCrate(selected.crate)
  }

  const flaggedById = useMemo(() => {
    const map = new Set(flaggedTracks.map((t) => t.id))
    return map
  }, [flaggedTracks])

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">{t('crates.title')}</h2>
        <p className="recall-section-sub">{t('crates.subtitle')}</p>
      </header>

      {flaggedTracks.length > 0 && (
        <div className="recall-flagged-banner glass-2">
          <FlaskConical size={16} strokeWidth={1.5} />
          <span>
            <Trans
              t={t}
              i18nKey="crates.flaggedBanner"
              values={{ count: flaggedTracks.length }}
              components={[<strong key="0" />]}
            />
          </span>
        </div>
      )}

      {loading && <div className="recall-empty">{t('crates.loading')}</div>}

      <div className="recall-crate-grid">
        {crates.map((crate: CrateWithCount) => (
          <div
            key={crate.id}
            role="button"
            tabIndex={0}
            className={`recall-crate-card glass-2${selected?.crate.id === crate.id ? ' active' : ''}`}
            onClick={() => void selectCrate(crate)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                void selectCrate(crate)
              }
            }}
          >
            <Layers size={18} strokeWidth={1.5} />
            <span className="recall-crate-name">{crate.name}</span>
            <span className="recall-crate-sub">{formatCrateRules(crate)}</span>
            <span className="recall-crate-count">
              {t('crates.trackCount', { count: crate.trackCount })}
            </span>
            {!crate.isSeed && (
              <button
                type="button"
                className="recall-crate-del"
                title={t('crates.deleteTitle')}
                aria-label={t('crates.deleteAria', { name: crate.name })}
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteCrate(crate.id)
                }}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="recall-crate-card recall-crate-new"
          onClick={() => setBuilding(true)}
        >
          <Plus size={18} strokeWidth={1.5} />
          <span className="recall-crate-name">{t('crates.newCrate')}</span>
        </button>
      </div>

      {building && <CrateBuilder onClose={() => setBuilding(false)} />}

      {selectedLoading && <div className="recall-empty">{t('crates.evaluating')}</div>}

      {selected && !selectedLoading && (
        <div className="recall-crate-tracks">
          <div className="recall-crate-head">
            <h3 className="ss-h3">
              {selected.crate.name} · {selected.tracks.length}
            </h3>
            <button
              type="button"
              className="recall-rules-toggle"
              onClick={() => setRulesOpen((s) => !s)}
            >
              {rulesOpen ? (
                <ChevronDown size={14} strokeWidth={1.5} />
              ) : (
                <ChevronRight size={14} strokeWidth={1.5} />
              )}
              {t('crates.rules')}
            </button>
          </div>

          {rulesOpen && (
            <div className="recall-rules-detail glass-2">
              <div className="recall-rules-mode">
                {t('crates.matchMode', {
                  match:
                    selected.crate.match === 'all'
                      ? t('crates.builder.matchAll')
                      : t('crates.builder.matchAny')
                })}
              </div>
              <ul>
                {formatCrateRuleLines(selected.crate).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {isUntestedCrate && checked.size > 0 && (
            <div className="recall-flag-bar glass-2">
              <FlaskConical size={14} strokeWidth={1.5} />
              <span>{t('crates.flagBarSelected', { count: checked.size })}</span>
              <button type="button" className="btn-primary" onClick={() => void handleFlag()}>
                {t('crates.flagForNextGig')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setChecked(new Set())}>
                {t('crates.clear')}
              </button>
            </div>
          )}

          <div className="recall-list">
            {selected.tracks.slice(0, MAX_RENDER).map((track: Track) => (
              <div key={track.id} className="recall-line-row">
                {isUntestedCrate && (
                  <input
                    type="checkbox"
                    className="recall-line-check"
                    checked={checked.has(track.id)}
                    onChange={() => toggleCheck(track.id)}
                    aria-label={t('crates.selectTrackAria', { title: track.title })}
                  />
                )}
                <RecallTrackLine
                  track={track}
                  badge={
                    flaggedById.has(track.id) ? (
                      <span className="recall-flagged-pill" title={t('crates.flaggedPillTitle')}>
                        <FlaskConical size={11} strokeWidth={1.5} /> {t('crates.testing')}
                      </span>
                    ) : undefined
                  }
                />
              </div>
            ))}
          </div>
          {selected.tracks.length > MAX_RENDER && (
            <div className="recall-more-note">
              {t('crates.showingFirst', { max: MAX_RENDER, total: selected.tracks.length })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
