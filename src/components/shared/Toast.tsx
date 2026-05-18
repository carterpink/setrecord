import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { motion } from '@/components/shared/Motion'
import { useToastStore, type Toast as ToastType } from '@/stores/toastStore'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} as const

interface Props {
  toast: ToastType
}

export function Toast({ toast }: Props): React.JSX.Element {
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
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
      >
        <X size={14} strokeWidth={1.7} />
      </button>
    </motion.div>
  )
}
