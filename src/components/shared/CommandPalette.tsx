import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { motion } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useSetStore } from '@/stores/setStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'

interface Command {
  id: string
  section: string
  label: string
  hint?: string
  run: () => void
}

/**
 * Lightweight fuzzy score. Higher is better; -1 means no match. Prefers prefix
 * matches, then word-boundary matches, then substring, then subsequence. No
 * external dependency — the codebase avoids adding libs for this.
 */
function score(query: string, text: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const s = text.toLowerCase()
  const idx = s.indexOf(q)
  if (idx === 0) return 1000 - s.length
  if (idx > 0) return (s[idx - 1] === ' ' ? 600 : 400) - idx
  // subsequence
  let qi = 0
  for (let i = 0; i < s.length && qi < q.length; i++) if (s[i] === q[qi]) qi++
  return qi === q.length ? 100 - s.length : -1
}

export function CommandPalette(): React.ReactPortal {
  const { t } = useTranslation('power')
  const closeModal = useUiStore((s) => s.closeModal)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const tracks = useLibraryStore((s) => s.tracks)
  const savedSets = useSetStore((s) => s.savedSets)

  // Make sure the set list is populated for the Sets section.
  useEffect(() => {
    void useSetStore.getState().loadSets()
    inputRef.current?.focus()
  }, [])

  const commands = useMemo<Command[]>(() => {
    const ui = useUiStore.getState()
    const close = (): void => ui.closeModal()
    const actions: Command[] = [
      {
        id: 'newSet',
        section: t('palette.sectionActions'),
        label: t('actions.newSet'),
        run: () => {
          useSetStore.getState().createSet()
          ui.setMode('Build')
          close()
        }
      },
      {
        id: 'import',
        section: t('palette.sectionActions'),
        label: t('actions.import'),
        run: () => {
          ui.showModal('import')
          void useLibraryStore.getState().startImportFlow()
        }
      },
      {
        id: 'architect',
        section: t('palette.sectionActions'),
        label: t('actions.architect'),
        run: () => {
          ui.showModal('architect')
        }
      },
      {
        id: 'export',
        section: t('palette.sectionActions'),
        label: t('actions.export'),
        run: () => {
          ui.setMode('Build')
          ui.showModal('export')
        }
      },
      {
        id: 'settings',
        section: t('palette.sectionActions'),
        label: t('actions.settings'),
        run: () => {
          ui.showModal('settings')
        }
      },
      {
        id: 'density',
        section: t('palette.sectionActions'),
        label: t('actions.toggleDensity'),
        run: () => {
          ui.toggleLibraryDensity()
          close()
        }
      }
    ]
    const nav: Command[] = [
      {
        id: 'goHome',
        section: t('palette.sectionNav'),
        label: t('actions.goHome'),
        run: () => {
          ui.setMode('Home')
          close()
        }
      },
      {
        id: 'goLibrary',
        section: t('palette.sectionNav'),
        label: t('actions.goLibrary'),
        run: () => {
          ui.setMode('Library')
          close()
        }
      },
      {
        id: 'goBuild',
        section: t('palette.sectionNav'),
        label: t('actions.goBuild'),
        run: () => {
          ui.setMode('Build')
          close()
        }
      }
    ]
    const trackCmds: Command[] = tracks.map((tr) => ({
      id: `track:${tr.id}`,
      section: t('palette.sectionTracks'),
      label: `${tr.title} — ${tr.artist}`,
      hint: `${tr.bpm} · ${tr.key}`,
      run: () => {
        ui.setMode('Library')
        useUiStore.getState().setSelectedLibraryTrack(tr.id)
        if (!(tr.missingFile || tr.phantom)) usePlaybackStore.getState().startPreview(tr)
        close()
      }
    }))
    const setCmds: Command[] = savedSets.map((st) => ({
      id: `set:${st.id}`,
      section: t('palette.sectionSets'),
      label: st.name,
      run: () => {
        void useSetStore.getState().loadCurrentSet(st.id)
        ui.setMode('Build')
        close()
      }
    }))
    return [...actions, ...nav, ...trackCmds, ...setCmds]
  }, [t, tracks, savedSets])

  const results = useMemo(() => {
    if (!query.trim()) {
      // No query: show actions + nav only (don't dump the whole library).
      return commands.filter((c) => !c.id.startsWith('track:') && !c.id.startsWith('set:'))
    }
    return commands
      .map((c) => ({ c, s: score(query, c.label) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((r) => r.c)
  }, [commands, query])

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[active]?.run()
    }
  }

  // Group consecutive results by section for the headers.
  let lastSection = ''

  return createPortal(
    <motion.div
      className="command-palette-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <motion.div
        className="command-palette glass-3"
        role="dialog"
        aria-label={t('palette.placeholder')}
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0.12, 1] }}
      >
        <div className="command-palette-input">
          <Search size={16} strokeWidth={1.7} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={t('palette.placeholder')}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="command-palette-results">
          {results.length === 0 ? (
            <div className="command-palette-empty">{t('palette.empty')}</div>
          ) : (
            results.map((c, i) => {
              const header = c.section !== lastSection ? c.section : null
              lastSection = c.section
              return (
                <div key={c.id}>
                  {header && <div className="command-palette-section">{header}</div>}
                  <button
                    type="button"
                    className={`command-palette-item${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => c.run()}
                  >
                    <span className="command-palette-label">{c.label}</span>
                    {c.hint && <span className="command-palette-hint">{c.hint}</span>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
