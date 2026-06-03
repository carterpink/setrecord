import { useEffect, useRef, useState } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { usePlaybackStore } from '@/stores/playbackStore'

/**
 * Collapses the preview-volume control into a single icon. Clicking opens a
 * small popover with a mute toggle + slider, so the always-visible footprint
 * is one button instead of an icon plus an 80px slider. All functionality
 * (mute and fine volume) is preserved inside the popover.
 */
export function VolumePopover(): React.JSX.Element {
  const volume = usePlaybackStore((s) => s.volume)
  const setVolume = usePlaybackStore((s) => s.setVolume)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const pct = Math.round(volume * 100)

  return (
    <div className="volume-popover-wrap" ref={ref}>
      <button
        type="button"
        className={clsx('volume-popover-trigger', open && 'volume-popover-trigger--open')}
        aria-label={`Volume ${pct}%`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Preview volume — ${pct}%`}
        onClick={() => setOpen((o) => !o)}
      >
        <VolumeIcon size={16} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="volume-popover-panel glass-3"
            role="dialog"
            aria-label="Volume"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0.12, 1] }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
