import type { LucideIcon } from 'lucide-react'
import { Upload } from 'lucide-react'
import { motion } from '@/components/shared/Motion'
import { Button } from '@/components/shared/Button'
import { useUiStore } from '@/stores/uiStore'

interface NoLibraryStateProps {
  /** Surface icon — defaults to the Upload glyph. */
  icon?: LucideIcon
  /** Headline. Defaults to the universal "import to unlock" message. */
  title?: string
  /** Warm, surface-specific sentence on what this feature does once a library is loaded. */
  body: string
}

/**
 * Strong empty state for any intelligence surface that needs a loaded library.
 * Routes hard to import: a primary CTA opens the import flow, and a secondary
 * link jumps straight to the "How to export Rekordbox XML" walkthrough. Use this
 * instead of a neutral EmptyState whenever the blocker is "no library yet".
 */
export function NoLibraryState({
  icon: Icon = Upload,
  title = 'Import your Rekordbox library to unlock this',
  body
}: NoLibraryStateProps): React.JSX.Element {
  const showModal = useUiStore((s) => s.showModal)
  const showImportGuide = useUiStore((s) => s.showImportGuide)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0.12, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        textAlign: 'center',
        gap: 10
      }}
    >
      <Icon size={32} strokeWidth={1.5} style={{ color: 'var(--accent)', marginBottom: 4 }} />
      <div className="ss-h3" style={{ maxWidth: 320 }}>
        {title}
      </div>
      <div className="ss-body-sm" style={{ opacity: 0.6, maxWidth: 300 }}>
        {body}
      </div>
      <Button
        variant="primary"
        icon={Upload}
        onClick={() => showModal('import')}
        style={{ marginTop: 8 }}
      >
        Import library
      </Button>
      <button
        type="button"
        className="ss-caption"
        onClick={showImportGuide}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: 4,
          marginTop: 2
        }}
      >
        How to export Rekordbox XML
      </button>
    </motion.div>
  )
}
