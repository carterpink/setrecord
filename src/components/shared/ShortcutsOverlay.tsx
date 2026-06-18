import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/shared/Modal'
import { useUiStore } from '@/stores/uiStore'

const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'

export function ShortcutsOverlay(): React.JSX.Element {
  const { t } = useTranslation('power')
  const closeModal = useUiStore((s) => s.closeModal)

  const groups: { title: string; items: { keys: string; label: string }[] }[] = [
    {
      title: t('shortcuts.groupLibrary'),
      items: [
        { keys: `${MOD} K`, label: t('shortcuts.searchFocus') },
        { keys: `${MOD} P`, label: t('shortcuts.commandPalette') },
        { keys: '?', label: t('shortcuts.shortcutsHelp') }
      ]
    },
    {
      title: t('shortcuts.groupSelection'),
      items: [
        { keys: `${MOD} A`, label: t('shortcuts.selectAll') },
        { keys: 'Space', label: t('shortcuts.toggleSelect') },
        { keys: 'Esc', label: t('shortcuts.clearSelection') }
      ]
    },
    {
      title: t('shortcuts.groupSet'),
      items: [
        { keys: `${MOD} N`, label: t('shortcuts.newSet') },
        { keys: `${MOD} Z`, label: t('shortcuts.undo') },
        { keys: 'Del', label: t('shortcuts.removeTrack') }
      ]
    },
    {
      title: t('shortcuts.groupPlayback'),
      items: [{ keys: 'Space', label: t('shortcuts.togglePlay') }]
    }
  ]

  return (
    <Modal
      onClose={closeModal}
      labelledById="shortcuts-title"
      maxWidth={520}
      bloom={{ icon: 'glyph' }}
    >
      <h2 id="shortcuts-title" className="modal-title">
        {t('shortcuts.title')}
      </h2>
      <div className="shortcuts-grid">
        {groups.map((g) => (
          <div key={g.title} className="shortcuts-group">
            <div className="shortcuts-group-title">{g.title}</div>
            {g.items.map((it) => (
              <div key={it.label} className="shortcuts-row">
                <span className="shortcuts-label">{it.label}</span>
                <kbd className="shortcuts-keys">{it.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
