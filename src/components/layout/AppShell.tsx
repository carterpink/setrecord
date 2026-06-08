import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreviewAudio } from '@/hooks/usePreviewAudio'
import { useKeyboard } from '@/hooks/useKeyboard'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Track, SetTrack } from '@/types'
import { LibraryPanel } from '@/components/library/LibraryPanel'
import { CuePointEditor } from '@/components/modals/CuePointEditor'
import { ExportModal } from '@/components/modals/ExportModal'
import { ImportModal } from '@/components/modals/ImportModal'
import { SetArchitectModal } from '@/components/modals/SetArchitectModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { OnboardingModal } from '@/components/modals/OnboardingModal'
import { FeedbackModal } from '@/components/modals/FeedbackModal'
import { IdentityReadyModal } from '@/components/modals/IdentityReadyModal'
import { PostGigPromptModal } from '@/components/modals/PostGigPromptModal'
import { UpgradeModal } from '@/components/modals/UpgradeModal'
import { RecallPanel } from '@/components/recall/RecallPanel'
import { CollabLayer } from '@/components/collab/CollabLayer'
import { HomeSurface } from '@/components/home/HomeSurface'
import { SuggestionsPanel } from '@/components/suggestions/SuggestionsPanel'
import { TimelinePanel } from '@/components/timeline/TimelinePanel'
import { DragPreviewCard } from '@/components/timeline/DragPreviewCard'
import { useLibraryStore } from '@/stores/libraryStore'
import { useTagStore } from '@/stores/tagStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useProgressStore } from '@/stores/progressStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { setWaveformQuality } from '@/utils/waveformPeaksCache'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ToastContainer } from '@/components/shared/ToastContainer'
import { AnimatePresence } from 'framer-motion'
import { BottomDock } from './BottomDock'
import { TopBar } from './TopBar'

type ActiveDrag =
  | { source: 'library'; track: Track }
  | { source: 'timeline'; setTrack: SetTrack }
  | null

export function AppShell(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const {
    openModal,
    onboardingVisible,
    showOnboarding,
    setEnergyAnalysis,
    mode,
    hydrateFromSettings
  } = useUiStore()
  const { loadLibrary, applyFileStatusChanges, patchTrackEnergy, patchTrackArtwork } =
    useLibraryStore()
  const { loadSets, addTrack, addTrackAt, reorderTracks } = useSetStore()
  const hydrateLicense = useLicenseStore((s) => s.hydrate)
  usePreviewAudio()
  useKeyboard()

  // Subscribe to background file-health push events from main process
  useEffect(() => {
    // Guard for browser-only preview where IPC bridge is absent
    if (typeof window.setrecord === 'undefined') return
    const unsub = window.setrecord.onFileStatusUpdate(applyFileStatusChanges)
    return unsub
  }, [applyFileStatusChanges])

  // Hydrate Learn Mode from persisted AppSettings on boot
  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    void window.setrecord.getSettings().then((s) => {
      hydrateFromSettings({
        learnModeEnabled: s.learnModeEnabled,
        isBeginner: s.isBeginner,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        language: s.language,
        keyNotation: s.keyNotation,
        reducedMotion: s.reducedMotion,
        launchMode: s.launchMode,
        voiceInputEnabled: s.voiceInputEnabled
      })
      usePlaybackStore.getState().applyPlaybackSettings({
        previewVolume: s.previewVolume,
        previewMaxSeconds: s.previewMaxSeconds,
        previewFade: s.previewFade,
        outputDeviceId: s.outputDeviceId
      })
      setWaveformQuality(s.waveformQuality)
    })
  }, [hydrateFromSettings])

  // Hydrate license entitlement from the main process (source of truth) on boot
  useEffect(() => {
    void hydrateLicense()
  }, [hydrateLicense])

  // Hydrate retention progress and mark this week active (weekly streak).
  useEffect(() => {
    void useProgressStore
      .getState()
      .hydrate()
      .then(() => useProgressStore.getState().recordActivity())
  }, [])

  // License activation deep-links (setrecord://activate?key=…). On mount we drain
  // any key buffered during cold start and signal the main process we're ready;
  // we also subscribe to live links that arrive while the app is open. Either
  // path opens the Upgrade modal pre-filled and auto-activates.
  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    const { showUpgradeWithKey } = useUiStore.getState()
    void window.setrecord.licenseConsumePendingActivation().then((key) => {
      if (key) showUpgradeWithKey(key)
    })
    const unsub = window.setrecord.onLicenseActivateDeepLink((key) => {
      if (key) showUpgradeWithKey(key)
    })
    return unsub
  }, [])

  // Subscribe to background energy-analysis events from main process
  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    const unsubProgress = window.setrecord.onEnergyProgress((p) => {
      setEnergyAnalysis(p.phase === 'done' ? null : { processed: p.processed, total: p.total })
      // The analyser writes auto-tags alongside energy; pull them in once the
      // background pass finishes so chips appear without a manual reload.
      if (p.phase === 'done' && p.total > 0) {
        void loadLibrary()
        void useTagStore.getState().loadCoverage()
      }
    })
    const unsubUpdate = window.setrecord.onEnergyUpdate((u) => {
      patchTrackEnergy(u.trackId, u.energy, u.source)
    })
    const unsubArtwork = window.setrecord.onArtworkUpdate((u) => {
      patchTrackArtwork(u.trackId, u.albumArtPath)
    })
    // Re-tag progress (manual "Re-tag library") → drive the Tags view + reload.
    const unsubTags = window.setrecord.onTagsProgress((p) => {
      useTagStore.getState().handleProgress(p)
    })
    return () => {
      unsubProgress()
      unsubUpdate()
      unsubArtwork()
      unsubTags()
    }
  }, [patchTrackEnergy, patchTrackArtwork, setEnergyAnalysis, loadLibrary])
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)

  useEffect(() => {
    loadLibrary().then(() => {
      const { hasLibrary } = useLibraryStore.getState()
      // Browser-only preview (no IPC): fall back to the library-presence check.
      if (typeof window.setrecord === 'undefined') {
        if (!hasLibrary) showOnboarding()
        return
      }
      void window.setrecord.getSettings().then((s) => {
        if (s.hasCompletedOnboarding) return
        // Existing user from before this flag existed: they already imported a
        // library, so treat them as onboarded silently rather than re-nagging.
        if (hasLibrary) {
          useUiStore.getState().completeOnboarding()
          return
        }
        showOnboarding()
      })
    })
    loadSets()
  }, [loadLibrary, loadSets, showOnboarding])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    // WCAG 2.1.1 — keyboard drag: Space/Enter to pick up, arrows to move,
    // Space/Enter to drop, Escape to cancel. Paired with dndAnnouncements below.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  /**
   * Screen-reader announcements for the timeline drag flow. dnd-kit's defaults
   * are generic ("draggable item picked up"); these tell the user which track
   * is moving and where it lands.
   */
  const dndAnnouncements = {
    onDragStart({ active }: { active: { id: string | number; data: { current?: unknown } } }) {
      const data = active.data.current as ActiveDrag
      if (data?.source === 'library' && data.track) {
        return t('dnd.pickedUpLibrary', { title: data.track.title, artist: data.track.artist })
      }
      if (data?.source === 'timeline' && data.setTrack) {
        return t('dnd.pickedUpTimeline', {
          title: data.setTrack.track.title,
          position: data.setTrack.position + 1
        })
      }
      return t('dnd.pickedUpGeneric')
    },
    onDragOver({ over }: { over: { id: string | number; data: { current?: unknown } } | null }) {
      if (!over) return t('dnd.overEmpty')
      const overData = over.data.current as { source?: string; setTrack?: SetTrack } | undefined
      if (over.id === 'timeline-droppable') return t('dnd.overDropZone')
      if (overData?.source === 'timeline' && overData.setTrack) {
        return t('dnd.overPosition', { position: overData.setTrack.position + 1 })
      }
      return ''
    },
    onDragEnd({
      active,
      over
    }: {
      active: { data: { current?: unknown } }
      over: { id: string | number; data: { current?: unknown } } | null
    }) {
      if (!over) return t('dnd.cancelledNoTarget')
      const activeData = active.data.current as ActiveDrag
      const overData = over.data.current as { source?: string; setTrack?: SetTrack } | undefined
      if (activeData?.source === 'library' && activeData.track) {
        return t('dnd.added', { title: activeData.track.title })
      }
      if (activeData?.source === 'timeline' && overData?.setTrack) {
        return t('dnd.moved', {
          title: activeData.setTrack.track.title,
          position: overData.setTrack.position + 1
        })
      }
      return t('dnd.complete')
    },
    onDragCancel() {
      return t('dnd.cancelled')
    }
  }

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current as ActiveDrag
    setActiveDrag(data)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const data = active.data.current as { source: string; track?: Track; setTrack?: SetTrack }
    const overData = over.data.current as { source?: string; setTrack?: SetTrack } | undefined

    if (data?.source === 'library' && data.track) {
      // Dropped on a specific timeline card → insert above/below based on cursor Y
      // relative to the card's vertical midpoint. Matches Apple Music / Rekordbox UX.
      if (overData?.source === 'timeline' && overData.setTrack) {
        const overRect = over.rect
        const activeRect = active.rect.current.translated
        const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
        const overCenterY = overRect.top + overRect.height / 2
        const insertIndex =
          activeCenterY < overCenterY ? overData.setTrack.position : overData.setTrack.position + 1
        addTrackAt(data.track, insertIndex)
        return
      }
      // Dropped on the timeline panel background (empty area / end) → append.
      if (over.id === 'timeline-droppable') {
        addTrack(data.track)
      }
    } else if (data?.source === 'timeline' && active.id !== over.id) {
      reorderTracks(active.id as string, over.id as string)
    }
  }

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <div className="app">
        <ErrorBoundary label="Toolbar" variant="chrome">
          <TopBar />
        </ErrorBoundary>
        {mode === 'Build' ? (
          <>
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              accessibility={{ announcements: dndAnnouncements }}
            >
              <div className="app-grid">
                <ErrorBoundary label="Library">
                  <LibraryPanel />
                </ErrorBoundary>
                <ErrorBoundary label="Timeline">
                  <TimelinePanel />
                </ErrorBoundary>
                <ErrorBoundary label="Suggestions">
                  <SuggestionsPanel />
                </ErrorBoundary>
              </div>
              <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                  activeDrag.source === 'library' ? (
                    <DragPreviewCard source="library" track={activeDrag.track} />
                  ) : (
                    <DragPreviewCard source="timeline" setTrack={activeDrag.setTrack} />
                  )
                ) : null}
              </DragOverlay>
            </DndContext>
            {/* Set-building tools — only meaningful while composing a set. */}
            <ErrorBoundary label="Set tools" variant="chrome">
              <BottomDock />
            </ErrorBoundary>
          </>
        ) : mode === 'Library' ? (
          <ErrorBoundary label="Library">
            <RecallPanel />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary label="Home">
            <HomeSurface />
          </ErrorBoundary>
        )}
      </div>
      <AnimatePresence mode="wait">
        {openModal === 'import' && (
          <ErrorBoundary key="import" label="Import">
            <ImportModal />
          </ErrorBoundary>
        )}
        {openModal === 'architect' && (
          <ErrorBoundary key="architect" label="Set Architect">
            <SetArchitectModal />
          </ErrorBoundary>
        )}
        {openModal === 'cueEditor' && (
          <ErrorBoundary key="cueEditor" label="Cue Point Editor">
            <CuePointEditor />
          </ErrorBoundary>
        )}
        {openModal === 'validate' && (
          <ErrorBoundary key="validate" label="Validate">
            <ExportModal validateOnly />
          </ErrorBoundary>
        )}
        {openModal === 'export' && (
          <ErrorBoundary key="export" label="Export">
            <ExportModal />
          </ErrorBoundary>
        )}
        {openModal === 'settings' && (
          <ErrorBoundary key="settings" label="Settings">
            <SettingsModal />
          </ErrorBoundary>
        )}
        {openModal === 'feedback' && (
          <ErrorBoundary key="feedback" label="Feedback">
            <FeedbackModal />
          </ErrorBoundary>
        )}
        {openModal === 'postGigPrompt' && (
          <ErrorBoundary key="postGigPrompt" label="Post-gig Prompt">
            <PostGigPromptModal />
          </ErrorBoundary>
        )}
        {openModal === 'upgrade' && (
          <ErrorBoundary key="upgrade" label="Upgrade">
            <UpgradeModal />
          </ErrorBoundary>
        )}
        {openModal === 'identityReady' && (
          <ErrorBoundary key="identityReady" label="Identity Ready">
            <IdentityReadyModal />
          </ErrorBoundary>
        )}
        {onboardingVisible && (
          <ErrorBoundary key="onboarding" label="Onboarding">
            <OnboardingModal />
          </ErrorBoundary>
        )}
      </AnimatePresence>
      <CollabLayer />
      <ToastContainer />
    </>
  )
}
