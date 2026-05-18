import type { LucideIcon } from 'lucide-react'
import { motion } from '@/components/shared/Motion'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  body: string
  cta?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, body, cta }: EmptyStateProps): React.JSX.Element {
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
        padding: '32px 16px',
        textAlign: 'center',
        gap: 8,
      }}
    >
      <Icon
        size={32}
        strokeWidth={1.5}
        style={{ opacity: 0.35, marginBottom: 4 }}
      />
      <div className="ss-h3">{title}</div>
      <div className="ss-body-sm" style={{ opacity: 0.55, maxWidth: 240 }}>
        {body}
      </div>
      {cta && (
        <button
          className="btn btn-secondary"
          style={{ marginTop: 8 }}
          onClick={cta.onClick}
        >
          {cta.label}
        </button>
      )}
    </motion.div>
  )
}
