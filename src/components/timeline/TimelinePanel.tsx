import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Sparkles,
  ListMusic,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Search,
  Layers
} from 'lucide-react'
import clsx from 'clsx'
import type { TimelineCurveView } from '@/types'
import { useToastStore } from '@/stores/toastStore'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Button } from '@/components/shared/Button'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useRecallStore } from '@/stores/recallStore'
import { useSuggestions } from '@/hooks/useSuggestions'
import { formatDuration } from '@/utils/format'
import { EnergyCurveGraph } from './EnergyCurveGraph'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { Coachmark } from '@/components/learn/Coachmark'
import { explainEnergyCurveView } from '@/utils/learnMode/explanations'
import { BEGINNER_TOOLTIP_COPY } from '@/utils/learnMode/coachmarks'
import { GhostTrackCard } from './GhostTrackCard'
import { TimelineTrackCard } from './TimelineTrackCard'
import { CollaborateButton } from '@/components/collab/CollaborateButton'

const VIEWS: readonly TimelineCurveView[] = ['Energy', 'BPM'] as const

function SaveStatusBadge({
  status,
  onRetry
}: {
  status: 'idle' | 'saving' | 'unsaved' | 'error'
  onRetry: () => void
}): React.JSX.Element | null {
  const { t } = useTranslation('timeline')
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span style={{ opacity: 0.55, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
        {t('saveStatus.saving')}
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span style={{ opacity: 0.55 }} aria-live="polite">
        {t('saveStatus.unsaved')}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      aria-label={t('saveStatus.retryAria')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: 'rgba(220, 38, 38, 0.12)',
        color: 'var(--semantic-danger)',
        border: '1px solid rgba(220, 38, 38, 0.35)',
        cursor: 'pointer',
        font: 'inherit'
      }}
    >
      <AlertTriangle size={12} strokeWidth={1.8} aria-hidden="true" />
      <span>{t('saveStatus.failed')}</span>
      <RefreshCw size={11} strokeWidth={1.8} aria-hidden="true" style={{ marginLeft: 2 }} />
    </button>
  )
}

export function TimelinePanel(): React.JSX.Element {
  const { t } = useTranslation('timeline')
  const [view, setView] = useState<TimelineCurveView>('Energy')
  const nameRef = useRef<HTMLInputElement>(null)

  const {
    currentSet,
    selectedTrackId,
    setSelectedTrack,
    removeTrack,
    renameCurrentSet,
    createSet,
    addTrackAfterSelected
  } = useSetStore()
  const saveStatus = useSetStore((s) => s.saveStatus)
  const retrySave = useSetStore((s) => s.retrySave)
  const showModal = useUiStore((s) => s.showModal)
  const showPostGigPrompt = useUiStore((s) => s.showPostGigPrompt)
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus)
  const toast = useToastStore.getState()
  const [marking, setMarking] = useState(false)

  async function handleMarkPerformed(): Promise<void> {
    if (!currentSet || tracks.length < 2 || !window.setsense) return
    setMarking(true)
    try {
      const sessionId = await window.setsense.historyMarkPerformed(currentSet.id)
      if (!sessionId) {
        toast.error(t('performed.markError'))
        return
      }
      const flagged = await window.setsense.lifecycleFlaggedInSession(sessionId)
      if (flagged.length > 0) {
        showPostGigPrompt({ sessionId, setName: currentSet.name, tracks: flagged })
      } else {
        toast.success(t('performed.logged', { name: currentSet.name }))
      }
    } catch {
      toast.error(t('performed.markFailed'))
    } finally {
      setMarking(false)
    }
  }

  const { setNodeRef, isOver } = useDroppable({ id: 'timeline-droppable' })

  const tracks = currentSet?.tracks ?? []
  const setTrackIds = tracks.map((st) => st.id)

  const totalSeconds = tracks.reduce((s, st) => s + st.track.duration, 0)
  const bpmValues = tracks.map((st) => st.track.bpm)
  const bpmMin = bpmValues.length ? Math.min(...bpmValues) : 0
  const bpmMax = bpmValues.length ? Math.max(...bpmValues) : 0
  const bpmAvg = bpmValues.length
    ? Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length)
    : 0

  // Ghost track: top suggestion for the currently selected track
  const selectedSetTrack = tracks.find((st) => st.id === selectedTrackId)
  const ghostTrackId =
    selectedSetTrack?.trackId ?? (tracks.length > 0 ? tracks[tracks.length - 1].trackId : null)
  const currentTrackIds = tracks.map((st) => st.trackId)
  const { suggestions: ghostSuggestions } = useSuggestions(
    ghostTrackId,
    currentSet?.id ?? null,
    1,
    currentTrackIds
  )
  const topSuggestion = ghostSuggestions[0] ?? null

  const selectedPosition = selectedSetTrack ? selectedSetTrack.position + 1 : null

  const isEmpty = !currentSet || tracks.length === 0

  // Empty-state paths. Each ensures there's a set to build into (without
  // duplicating an existing empty one) before routing to the chosen tool.
  function ensureSet(): void {
    if (!currentSet) createSet()
  }
  function browseLibrary(): void {
    ensureSet()
    requestSearchFocus()
  }
  function discoverInLibrary(): void {
    ensureSet()
    useRecallStore.getState().setSection('uncover')
    useUiStore.getState().setMode('Library')
  }

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const v = e.currentTarget.value.trim()
    if (v) renameCurrentSet(v)
    else if (nameRef.current && currentSet) nameRef.current.value = currentSet.name
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      if (nameRef.current && currentSet) nameRef.current.value = currentSet.name
      nameRef.current?.blur()
    }
  }

  return (
    <div className="panel glass-1">
      <div className="tl-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            ref={nameRef}
            className="tl-name-input"
            defaultValue={currentSet?.name ?? ''}
            key={currentSet?.id}
            placeholder={t('header.namePlaceholder')}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
          />
          {currentSet ? (
            <div
              className="ss-caption"
              style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
            >
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }}
              >
                {formatDuration(totalSeconds)} · {t('header.trackCount', { count: tracks.length })}
                {bpmValues.length > 1
                  ? ` · ${t('header.bpmStats', {
                      avg: bpmAvg,
                      min: Math.round(bpmMin),
                      max: Math.round(bpmMax)
                    })}`
                  : bpmValues.length === 1
                    ? ` · ${t('header.bpmSingle', { bpm: Math.round(bpmValues[0]) })}`
                    : ''}
              </span>
              <SaveStatusBadge status={saveStatus} onRetry={retrySave} />
            </div>
          ) : (
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
              {t('header.noSetLoaded')}
            </div>
          )}
        </div>
        <CollaborateButton />
        {currentSet && tracks.length >= 2 && (
          <Button
            variant="ghost"
            onClick={() => void handleMarkPerformed()}
            disabled={marking}
            title={t('header.markPerformedTitle')}
          >
            <CheckCircle2 size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
            {marking ? t('header.logging') : t('header.markPerformed')}
          </Button>
        )}
        <Coachmark concept="energyCurve">
          <LearnTooltip
            explanation={explainEnergyCurveView()}
            basic={BEGINNER_TOOLTIP_COPY.energyCurve}
            iconLabel={t('header.curveHelpAria')}
          >
            <SegmentedControl options={VIEWS} value={view} onChange={setView} />
          </LearnTooltip>
        </Coachmark>
      </div>

      <EnergyCurveGraph
        tracks={tracks}
        selectedPosition={selectedPosition}
        viewMode={view === 'BPM' ? 'bpm' : 'energy'}
        energyCurveType={currentSet?.energyCurveType}
      />

      <div ref={setNodeRef} className={clsx('tl-list', isOver && 'drop-over')}>
        {isEmpty ? (
          <div className="tl-empty">
            <ListMusic size={32} strokeWidth={1} style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <div className="ss-body" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                {currentSet
                  ? t('empty.readyTitle', { name: currentSet.name })
                  : t('empty.blankTitle')}
              </div>
              <div className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('empty.subtitle')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="primary" onClick={browseLibrary}>
                <Search size={13} strokeWidth={1.7} style={{ marginRight: 4 }} />
                {t('empty.browse')}
              </Button>
              <Button variant="ghost" onClick={discoverInLibrary}>
                <Layers size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
                {t('empty.discover')}
              </Button>
              <Button variant="ghost" onClick={() => showModal('architect')}>
                <Sparkles size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
                {t('empty.buildForMe')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SortableContext items={setTrackIds} strategy={verticalListSortingStrategy}>
              {tracks.map((st, idx) => (
                <TimelineTrackCard
                  key={st.id}
                  setTrack={st}
                  previousTrack={idx > 0 ? tracks[idx - 1].track : undefined}
                  isSelected={selectedTrackId === st.id}
                  onSelect={() => {
                    setSelectedTrack(st.id)
                    useUiStore.getState().setSelectedLibraryTrack(null)
                  }}
                  onRemove={() => removeTrack(st.id)}
                />
              ))}
            </SortableContext>
            {topSuggestion && (
              <GhostTrackCard
                suggestion={topSuggestion}
                onAdd={() => addTrackAfterSelected(topSuggestion.track)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
