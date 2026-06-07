import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Music2 } from 'lucide-react'
import clsx from 'clsx'
import type { Playlist } from '@/types'
import { motion, AnimatePresence } from '@/components/shared/Motion'

interface PlaylistSourceDropdownProps {
  playlists: Playlist[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  /** Total count for the "All library" sentinel row. */
  totalCount: number
}

/**
 * Multi-select dropdown that picks zero or more leaf playlists as a source pool.
 * Empty selection = "All library" (no filter applied).
 * Shared between the Set Architect modal and the Suggestions panel.
 */
export function PlaylistSourceDropdown({
  playlists,
  selectedIds,
  onChange,
  totalCount
}: PlaylistSourceDropdownProps): React.JSX.Element | null {
  const { t } = useTranslation('shared')
  const leafPlaylists = useMemo(
    () => playlists.filter((p) => !p.isFolder && p.trackIds.length > 0),
    [playlists]
  )
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (leafPlaylists.length === 0) return null

  const label =
    selectedIds.length === 0
      ? t('playlistSource.allLibrary')
      : selectedIds.length === 1
        ? (leafPlaylists.find((p) => p.id === selectedIds[0])?.name ??
          t('playlistSource.onePlaylist'))
        : t('playlistSource.manyPlaylists', { count: selectedIds.length })

  function toggle(id: string): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div ref={ref} className="arch-playlist-dropdown-wrap">
      <button
        type="button"
        className="arch-playlist-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <Music2 size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.55 }} />
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0.12, 1] }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <ChevronDown size={13} strokeWidth={1.5} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="arch-playlist-dropdown"
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0.12, 1] }}
            style={{ transformOrigin: 'top' }}
          >
            <button
              type="button"
              className={clsx(
                'arch-playlist-option',
                selectedIds.length === 0 && 'arch-playlist-option-active'
              )}
              onClick={() => {
                onChange([])
                setOpen(false)
              }}
            >
              <span className="arch-playlist-option-check">
                {selectedIds.length === 0 && <Check size={10} strokeWidth={2.5} />}
              </span>
              <span style={{ flex: 1 }}>{t('playlistSource.allLibrary')}</span>
              <span className="arch-playlist-option-count">{totalCount.toLocaleString()}</span>
            </button>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            {leafPlaylists.map((p) => {
              const selected = selectedIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={clsx(
                    'arch-playlist-option',
                    selected && 'arch-playlist-option-active'
                  )}
                  onClick={() => toggle(p.id)}
                >
                  <span className="arch-playlist-option-check">
                    {selected && <Check size={10} strokeWidth={2.5} />}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {p.name}
                  </span>
                  <span className="arch-playlist-option-count">
                    {p.trackIds.length.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
