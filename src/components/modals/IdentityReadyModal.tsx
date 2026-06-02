import { Fingerprint, X } from 'lucide-react'
import FocusLock from 'react-focus-lock'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { IconButton } from '@/components/shared/IconButton'
import { IdentityShareCard } from '@/components/recall/IdentityShareCard'
import { useUiStore } from '@/stores/uiStore'
import { useRecallStore } from '@/stores/recallStore'

export function IdentityReadyModal(): React.JSX.Element {
  const closeModal = useUiStore((s) => s.closeModal)
  const identity = useRecallStore((s) => s.identity)

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
          className="modal glass-3 identity-ready-modal"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-label="Your DJ fingerprint is ready"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="identity-ready-heading">
              <Fingerprint size={18} strokeWidth={1.7} className="identity-ready-icon" />
              <div>
                <span className="ss-h2">Your DJ fingerprint is ready</span>
                <p className="identity-ready-sub">
                  SetSense has enough data to paint your sound. Share it or keep it to yourself.
                </p>
              </div>
            </div>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body identity-ready-body">
            {identity && (
              <div className="identity-ready-card-wrap">
                <IdentityShareCard identity={identity} />
              </div>
            )}
          </div>

          <div className="identity-ready-footer">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              Not now
            </button>
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
