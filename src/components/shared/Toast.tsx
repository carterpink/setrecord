import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { motion } from '@/components/shared/Motion'
import { useToastStore, type Toast as ToastType } from '@/stores/toastStore'
import { useSetStore } from '@/stores/setStore'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
} as const

interface Props {
  toast: ToastType
}

/** Inline "change set" picker shown on add-to-set toasts. */
function SetMovePicker({
  trackId,
  fromSetId,
  onDone
}: {
  trackId: string
  fromSetId: string
  onDone: () => void
}): React.JSX.Element | null {
  const { t } = useTranslation('shared')
  const savedSets = useSetStore((s) => s.savedSets)
  const currentSet = useSetStore((s) => s.currentSet)
  const moveTrackToSet = useSetStore((s) => s.moveTrackToSet)

  // De-dupe the current set into the saved list (it may be newer / not yet in savedSets).
  const sets =
    currentSet && !savedSets.some((s) => s.id === currentSet.id)
      ? [currentSet, ...savedSets]
      : savedSets
  if (sets.length < 2) return null

  return (
    <select
      className="toast-set-select"
      value={fromSetId}
      aria-label={t('toast.moveAria')}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const toId = e.target.value
        if (toId !== fromSetId) moveTrackToSet(trackId, fromSetId, toId)
        onDone()
      }}
    >
      {sets.map((s) => (
        <option key={s.id} value={s.id}>
          {s.id === fromSetId ? s.name : t('toast.moveToSet', { name: s.name })}
        </option>
      ))}
    </select>
  )
}

export function Toast({ toast }: Props): React.JSX.Element {
  const { t } = useTranslation('shared')
  const dismiss = useToastStore((s) => s.dismiss)
  const Icon = ICONS[toast.kind]

  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.durationMs)
    return () => clearTimeout(t)
  }, [toast.id, toast.durationMs, dismiss])

  return (
    <motion.div
      layout
      className={`toast toast-${toast.kind} glass-2`}
      initial={{ opacity: 0, x: 32, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0.12, 1] }}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} strokeWidth={1.7} className="toast-icon" aria-hidden="true" />
      <div className="toast-body">
        <span className="toast-message">{toast.message}</span>
        {toast.setMove && (
          <SetMovePicker
            trackId={toast.setMove.trackId}
            fromSetId={toast.setMove.fromSetId}
            onDone={() => dismiss(toast.id)}
          />
        )}
        {toast.action && (
          <button
            type="button"
            className="toast-action"
            onClick={(e) => {
              e.stopPropagation()
              toast.action?.onClick()
              dismiss(toast.id)
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label={t('toast.dismiss')}
        onClick={() => dismiss(toast.id)}
      >
        <X size={14} strokeWidth={1.7} />
      </button>
    </motion.div>
  )
}
