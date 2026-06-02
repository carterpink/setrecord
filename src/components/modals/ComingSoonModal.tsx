import FocusLock from 'react-focus-lock'
import { X } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'

interface Props {
  feature: string
  phase: number
}

export function ComingSoonModal({ feature, phase }: Props): React.JSX.Element {
  const { closeModal } = useUiStore()

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeModal}
    >
      <FocusLock returnFocus>
        <motion.div
          className="modal glass-3"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ maxWidth: 400, textAlign: 'center' }}
          role="dialog"
          aria-modal="true"
          aria-label={feature}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header" style={{ justifyContent: 'flex-end', paddingBottom: 0 }}>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body" style={{ paddingTop: 8, paddingBottom: 28 }}>
            <div className="ss-h2" style={{ marginBottom: 8 }}>
              {feature}
            </div>
            <div
              className="ss-body-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: 24 }}
            >
              Coming in Phase {phase}. This feature is on the roadmap and will be ready soon.
            </div>
            <Button variant="secondary" onClick={closeModal}>
              Got it
            </Button>
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
