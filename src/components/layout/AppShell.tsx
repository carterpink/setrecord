import { useEffect, useRef, useState } from 'react'
import { usePreviewAudio } from '@/hooks/usePreviewAudio'
import { useKeyboard } from '@/hooks/useKeyboard'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
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
import { SuggestionsPanel } from '@/components/suggestions/SuggestionsPanel'
import { TimelinePanel } from '@/components/timeline/TimelinePanel'
import { DragPreviewCard } from '@/components/timeline/DragPreviewCard'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'
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
  const {
    openModal,
    onboardingVisible,
    showOnboarding,
    lightMode,
    setEnergyAnalysis,
    mode,
    hydrateFromSettings
  } = useUiStore()
  const { loadLibrary, applyFileStatusChanges, patchTrackEnergy, patchTrackArtwork } =
    useLibraryStore()
  const { loadSets, addTrack, addTrackAt, reorderTracks } = useSetStore()
  const hydrateLicense = useLicenseStore((s) => s.hydrate)
  const themeHasMounted = useRef(false)

  usePreviewAudio()
  useKeyboard()

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', lightMode ? 'light' : 'dark')
    if (!themeHasMounted.current) {
      themeHasMounted.current = true
      return
    }
    root.classList.add('theme-transitioning')
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 650)
    return () => clearTimeout(t)
  }, [lightMode])

  // Subscribe to background file-health push events from main process
  useEffect(() => {
    // Guard for browser-only preview where IPC bridge is absent
    if (typeof window.setsense === 'undefined') return
    const unsub = window.setsense.onFileStatusUpdate(applyFileStatusChanges)
    return unsub
  }, [applyFileStatusChanges])

  // Hydrate Learn Mode from persisted AppSettings on boot
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    void window.setsense
      .getSettings()
      .then((s) => hydrateFromSettings({ learnModeEnabled: s.learnModeEnabled }))
  }, [hydrateFromSettings])

  // Hydrate license entitlement from the main process (source of truth) on boot
  useEffect(() => {
    void hydrateLicense()
  }, [hydrateLicense])

  // License activation deep-links (setsense://activate?key=…). On mount we drain
  // any key buffered during cold start and signal the main process we're ready;
  // we also subscribe to live links that arrive while the app is open. Either
  // path opens the Upgrade modal pre-filled and auto-activates.
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    const { showUpgradeWithKey } = useUiStore.getState()
    void window.setsense.licenseConsumePendingActivation().then((key) => {
      if (key) showUpgradeWithKey(key)
    })
    const unsub = window.setsense.onLicenseActivateDeepLink((key) => {
      if (key) showUpgradeWithKey(key)
    })
    return unsub
  }, [])

  // Subscribe to background energy-analysis events from main process
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    const unsubProgress = window.setsense.onEnergyProgress((p) => {
      setEnergyAnalysis(p.phase === 'done' ? null : { processed: p.processed, total: p.total })
    })
    const unsubUpdate = window.setsense.onEnergyUpdate((u) => {
      patchTrackEnergy(u.trackId, u.energy, u.source)
    })
    const unsubArtwork = window.setsense.onArtworkUpdate((u) => {
      patchTrackArtwork(u.trackId, u.albumArtPath)
    })
    return () => {
      unsubProgress()
      unsubUpdate()
      unsubArtwork()
    }
  }, [patchTrackEnergy, patchTrackArtwork, setEnergyAnalysis])
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)

  useEffect(() => {
    loadLibrary().then(() => {
      const { hasLibrary } = useLibraryStore.getState()
      if (!hasLibrary) showOnboarding()
    })
    loadSets()
  }, [loadLibrary, loadSets, showOnboarding])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
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
        return `Picked up ${data.track.title} by ${data.track.artist}. Drop it on the timeline to add it to the set.`
      }
      if (data?.source === 'timeline' && data.setTrack) {
        return `Picked up ${data.setTrack.track.title} from position ${data.setTrack.position + 1}.`
      }
      return 'Picked up a track.'
    },
    onDragOver({ over }: { over: { id: string | number; data: { current?: unknown } } | null }) {
      if (!over) return 'Track is over an empty area.'
      const overData = over.data.current as { source?: string; setTrack?: SetTrack } | undefined
      if (over.id === 'timeline-droppable') return 'Hovering the timeline drop zone.'
      if (overData?.source === 'timeline' && overData.setTrack) {
        return `Hovering position ${overData.setTrack.position + 1}.`
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
      if (!over) return 'Drag cancelled — no drop target.'
      const activeData = active.data.current as ActiveDrag
      const overData = over.data.current as { source?: string; setTrack?: SetTrack } | undefined
      if (activeData?.source === 'library' && activeData.track) {
        return `Added ${activeData.track.title} to the set.`
      }
      if (activeData?.source === 'timeline' && overData?.setTrack) {
        return `Moved ${activeData.setTrack.track.title} to position ${overData.setTrack.position + 1}.`
      }
      return 'Drag complete.'
    },
    onDragCancel() {
      return 'Drag cancelled.'
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
        <TopBar />
        {mode === 'Prepare' ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements: dndAnnouncements }}
          >
            <div className="app-grid">
              <ErrorBoundary label="library">
                <LibraryPanel />
              </ErrorBoundary>
              <ErrorBoundary label="timeline">
                <TimelinePanel />
              </ErrorBoundary>
              <ErrorBoundary label="suggestions">
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
        ) : (
          <ErrorBoundary label="Recall">
            <RecallPanel />
          </ErrorBoundary>
        )}
        <BottomDock visible />
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
      <ToastContainer />
    </>
  )
}
