import { useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  Download,
  Home,
  Library,
  MessageSquareHeart,
  Plus,
  Radio,
  Settings,
  Sliders,
  Sparkles,
  TimerReset,
  Upload
} from 'lucide-react'
import type { AppMode, TransitionDotKind } from '@/types'
import { Badge } from '@/components/shared/Badge'
import { Button } from '@/components/shared/Button'
import { Logo } from '@/components/shared/Logo'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { USBDetectionPanel } from '@/components/shared/USBDetectionPanel'
import { OverflowMenu, OverflowMenuItem } from '@/components/shared/OverflowMenu'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore, useTrialInfo, useRenewalInfo } from '@/stores/licenseStore'
import { startAudioFeed, type AudioFeedHandle } from '@/components/live/audioFeed'
import { startScreenReader, type ScreenReaderHandle } from '@/components/live/screenReader'
import { LiveDevicePicker } from '@/components/live/LiveDevicePicker'
import { getPreferredInputId } from '@/components/live/liveDevice'
import { useToastStore } from '@/stores/toastStore'
import { VolumePopover } from './VolumePopover'

const MODES: readonly AppMode[] = ['Home', 'Library', 'Build'] as const

// --ease-snappy. Shared so the contextual reflow matches the rest of the app.
const SNAPPY = [0.32, 0.72, 0.12, 1] as const

// Contextual chunks fade + lift + de-blur in, and slide to fill space as
// neighbours appear/disappear (layout). One transition reused everywhere keeps
// the bar feeling like a single coordinated surface.
const ctx = {
  initial: { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
  transition: { duration: 0.3, ease: SNAPPY, layout: { duration: 0.4, ease: SNAPPY } }
} as const

export function TopBar(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const showModal = useUiStore((s) => s.showModal)
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const isPro = useLicenseStore((s) => s.license.tier === 'pro')
  const trial = useTrialInfo()
  const renewal = useRenewalInfo()
  const currentSet = useSetStore((s) => s.currentSet)
  const createSet = useSetStore((s) => s.createSet)
  const libraryStale = useLibraryStore((s) => s.libraryStale)
  const checkStale = useLibraryStore((s) => s.checkStale)

  // SetSense Live runs in a separate transparent overlay window (main process).
  // Track open/closed here so the toggle reflects reality, including when the
  // overlay is dismissed from its own End button.
  const [isLive, setIsLive] = useState(false)
  const feedRef = useRef<AudioFeedHandle | null>(null)
  const screenRef = useRef<ScreenReaderHandle | null>(null)

  const stopSensors = (): void => {
    void feedRef.current?.stop()
    feedRef.current = null
    void screenRef.current?.stop()
    screenRef.current = null
  }

  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    // If the overlay is closed from its own End button, mirror it here.
    return window.setsense.onLiveOverlayClosed(() => {
      stopSensors()
      setIsLive(false)
    })
  }, [])

  function toggleLive(): void {
    if (isLive) {
      void window.setsense?.liveStop()
      stopSensors()
      setIsLive(false)
      return
    }
    setIsLive(true)

    // Primary sensor: read the screen (universal — Rekordbox/Serato/Spotify/etc).
    // Kicked off on the click so getDisplayMedia keeps its user gesture.
    startScreenReader((lines) => window.setsense?.liveScreenText(lines))
      .then((h) => {
        screenRef.current = h
      })
      .catch((err) => {
        console.error('[live] screen reader failed', err)
        useToastStore.getState().error(t('live.screenPermissionError'))
      })

    // Open the overlay + minimise + start the metadata poll.
    void window.setsense?.liveStart()

    // Optional audio fingerprint fallback — only if a loopback/master input is
    // explicitly chosen (avoids a needless mic prompt for the default flow).
    const dev = getPreferredInputId()
    if (dev) {
      startAudioFeed(dev, (samples) => window.setsense?.liveAudioWindow(samples))
        .then((h) => {
          feedRef.current = h
        })
        .catch((err) => console.error('[live] audio capture failed', err))
    }
  }

  // Refresh stale flag on mount + every time the window regains focus —
  // covers "the user just closed Rekordbox and came back to SetSense."
  useEffect(() => {
    void checkStale()
    const handler = (): void => {
      void checkStale()
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [checkStale])

  // One-tap new set from anywhere. Pre-fills last-used BPM window + hardware
  // (handled in createSet) so the DJ is building in seconds. If the current set
  // is already a fresh empty one, reuse it rather than spawning a duplicate.
  function handleNewSet(): void {
    if (!currentSet || currentSet.tracks.length > 0) createSet()
    setMode('Build')
  }

  const score = currentSet?.safetyScore
  const hw = currentSet?.targetHardware
  const hasTracks = (currentSet?.tracks.length ?? 0) > 0
  const validated = score != null

  // Three states, all neutral until a validation run finds a real problem:
  //   empty   — no set yet, or a set with no tracks → inviting prompt
  //   pending — built but not validated → neutral, not a warning
  //   scored  — validated → severity reflects the actual score
  const dotKind: TransitionDotKind = !validated
    ? 'info'
    : score >= 80
      ? 'success'
      : score >= 50
        ? 'warning'
        : 'danger'
  // Keep the pill compact — the full explanation lives in the tooltip. A long
  // value string here is what crowds the bar in Build mode.
  const badgeValue = validated
    ? hw
      ? t('boothCheck.valueReady', { score, hw })
      : t('boothCheck.value', { score })
    : hasTracks
      ? t('boothCheck.checkSet')
      : undefined
  const energyAnalysis = useUiStore((s) => s.energyAnalysis)

  const badgeTitle = hasTracks
    ? validated
      ? t('boothCheck.titleValidated', { score })
      : t('boothCheck.titlePending')
    : t('boothCheck.titleEmpty')

  const isBuild = mode === 'Build'
  // Volume only matters where preview audio plays (building / browsing).
  const showVolume = mode === 'Build' || mode === 'Library'
  // Keep the Live toggle reachable whenever the overlay is running, even if the
  // DJ has navigated away from Build — otherwise they couldn't end it from here.
  const showLive = isBuild || isLive

  return (
    <div className="topbar glass-2">
      <div className="topbar-left">
        <Logo />
        <SegmentedControl
          options={MODES}
          value={mode}
          onChange={setMode}
          icons={{ Home, Library, Build: Sliders }}
        />
      </div>

      <motion.div className="topbar-center" layout transition={ctx.transition}>
        <AnimatePresence mode="popLayout">
          {isBuild && (
            <motion.div
              key="set-tools"
              className="topbar-context"
              layout
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              <Button
                variant="secondary"
                icon={Plus}
                onClick={handleNewSet}
                title={t('setTools.newSetTitle')}
              >
                {t('setTools.newSet')}
              </Button>
              <Badge
                dot={dotKind}
                label={t('boothCheck.label')}
                value={badgeValue}
                glass={1}
                onClick={
                  !isPro
                    ? () => showUpgrade('export')
                    : hasTracks
                      ? () => showModal('validate')
                      : undefined
                }
                title={isPro ? badgeTitle : t('boothCheck.titleProGate')}
              />
            </motion.div>
          )}

          {showLive && (
            <motion.div
              key="live"
              className="topbar-context"
              layout
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              {!isLive && <LiveDevicePicker />}
              <Button
                variant={isLive ? 'primary' : 'ghost'}
                icon={Radio}
                onClick={() => void toggleLive()}
                title={isLive ? t('live.endTitle') : t('live.goLiveTitle')}
              >
                {isLive ? t('live.live') : t('live.goLive')}
              </Button>
            </motion.div>
          )}

          {energyAnalysis && energyAnalysis.total > 0 && (
            <motion.span
              key="energy-analysis-pill"
              layout
              className="energy-analysis-pill"
              role="status"
              aria-live="polite"
              title={t('energy.pillTitle')}
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              <Trans
                t={t}
                i18nKey="energy.pill"
                values={{ processed: energyAnalysis.processed, total: energyAnalysis.total }}
                components={[<span key="0" className="mono" />]}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div className="topbar-right" layout transition={ctx.transition}>
        <motion.div className="topbar-item" layout transition={ctx.transition}>
          <USBDetectionPanel />
        </motion.div>

        <AnimatePresence mode="popLayout">
          {showVolume && (
            <motion.div
              key="volume"
              className="topbar-item"
              layout
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              <VolumePopover />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="topbar-item" layout transition={ctx.transition}>
          <OverflowMenu aria-label={t('menu.moreAria')} title={t('menu.more')} dot={libraryStale}>
            {(close) => (
              <>
                <OverflowMenuItem
                  icon={Upload}
                  label={t('menu.importLibrary')}
                  badge={libraryStale}
                  onClick={() => {
                    close()
                    showModal('import')
                  }}
                />
                <OverflowMenuItem
                  icon={MessageSquareHeart}
                  label={t('menu.sendFeedback')}
                  onClick={() => {
                    close()
                    showModal('feedback')
                  }}
                />
                <OverflowMenuItem
                  icon={Settings}
                  label={t('menu.settings')}
                  onClick={() => {
                    close()
                    showModal('settings')
                  }}
                />
              </>
            )}
          </OverflowMenu>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {trial.onTrial && (
            <motion.div
              key="trial"
              className="topbar-item"
              layout
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              <Button
                variant="ghost"
                icon={TimerReset}
                className={`topbar-trial${trial.daysRemaining <= 2 ? ' topbar-trial-urgent' : ''}`}
                onClick={() => showUpgrade()}
                title={
                  trial.daysRemaining <= 1
                    ? t('trial.titleLastDay')
                    : t('trial.title', { days: trial.daysRemaining })
                }
              >
                {trial.daysRemaining <= 1
                  ? t('trial.labelLastDay')
                  : trial.daysRemaining === 2
                    ? t('trial.labelTwoDays')
                    : t('trial.label', { days: trial.daysRemaining })}
              </Button>
            </motion.div>
          )}
          {renewal.expiringSoon && (
            <motion.div
              key="renewal"
              className="topbar-item"
              layout
              initial={ctx.initial}
              animate={ctx.animate}
              exit={ctx.exit}
              transition={ctx.transition}
            >
              <Button
                variant="ghost"
                icon={TimerReset}
                className={`topbar-trial${renewal.daysRemaining <= 3 ? ' topbar-trial-urgent' : ''}`}
                onClick={() => showUpgrade()}
                title={t('renewal.title', { count: renewal.daysRemaining })}
              >
                {renewal.daysRemaining <= 1
                  ? t('renewal.labelTomorrow')
                  : t('renewal.label', { days: renewal.daysRemaining })}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="topbar-item" layout transition={ctx.transition}>
          {isPro ? (
            <Button variant="primary" icon={Download} onClick={() => showModal('export')}>
              {t('actions.export')}
            </Button>
          ) : (
            <Button variant="primary" icon={Sparkles} onClick={() => showUpgrade()}>
              {t('actions.goPro')}
            </Button>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
