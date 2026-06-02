import { AnimatePresence } from '@/components/shared/Motion'
import { useToastStore } from '@/stores/toastStore'
import { Toast } from './Toast'

export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}
