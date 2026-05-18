import { Download, Moon, Settings, Sun, Upload, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { AppMode, TransitionDotKind } from '@/types'
import { Badge } from '@/components/shared/Badge'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Logo } from '@/components/shared/Logo'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { USBDetectionPanel } from '@/components/shared/USBDetectionPanel'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'

const MODES: readonly AppMode[] = ['Prepare', 'Discover'] as const

export function TopBar(): React.JSX.Element {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const showModal = useUiStore((s) => s.showModal)
  const lightMode = useUiStore((s) => s.lightMode)
  const toggleLightMode = useUiStore((s) => s.toggleLightMode)
  const currentSet = useSetStore((s) => s.currentSet)
  const volume = usePlaybackStore((s) => s.volume)
  const setVolume = usePlaybackStore((s) => s.setVolume)

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const score = currentSet?.safetyScore
  const hw = currentSet?.targetHardware
  const dotKind: TransitionDotKind =
    score == null ? 'info' : score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger'
  const badgeValue = score != null && hw ? `${score}% · ${hw} ready` : 'Not validated'
  const energyAnalysis = useUiStore((s) => s.energyAnalysis)

  return (
    <div className="topbar glass-2">
      <div className="topbar-left">
        <Logo />
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      </div>

      <div className="topbar-center">
        <Badge dot={dotKind} label="Set safety" value={badgeValue} glass={1} />
        <AnimatePresence>
          {energyAnalysis && energyAnalysis.total > 0 && (
            <motion.span
              key="energy-analysis-pill"
              className="energy-analysis-pill"
              role="status"
              aria-live="polite"
              title="Analysing track loudness + dynamics to compute energy scores"
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0.12, 1] }}
            >
              Analysing energy{' '}
              <span className="mono">
                {energyAnalysis.processed} / {energyAnalysis.total}
              </span>
              …
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="topbar-right">
        <USBDetectionPanel />
        <div className="volume-control">
          <button
            type="button"
            className="volume-icon-btn"
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
          >
            <VolumeIcon size={15} strokeWidth={1.7} />
          </button>
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Volume"
            style={{ '--_pct': `${volume * 100}%` } as React.CSSProperties}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
        <Button variant="secondary" icon={Upload} onClick={() => showModal('import')}>
          Import
        </Button>
        <button
          type="button"
          className="theme-toggle"
          aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-pressed={lightMode}
          title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          onClick={toggleLightMode}
        >
          <span className="theme-icon theme-icon-sun" aria-hidden="true">
            <Sun size={16} strokeWidth={1.7} />
          </span>
          <span className="theme-icon theme-icon-moon" aria-hidden="true">
            <Moon size={16} strokeWidth={1.7} />
          </span>
        </button>
        <IconButton icon={Settings} aria-label="Settings" onClick={() => showModal('settings')} />
        <Button variant="primary" icon={Download} onClick={() => showModal('export')}>
          Export
        </Button>
      </div>
    </div>
  )
}
