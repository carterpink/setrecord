import { useTranslation } from 'react-i18next'
import { Fingerprint, X } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import { Modal } from '@/components/shared/Modal'
import { IconButton } from '@/components/shared/IconButton'
import { IdentityShareCard } from '@/components/recall/IdentityShareCard'
import { useUiStore } from '@/stores/uiStore'
import { useRecallStore } from '@/stores/recallStore'

export function IdentityReadyModal(): React.JSX.Element {
  const { t } = useTranslation('modals')
  const closeModal = useUiStore((s) => s.closeModal)
  const identity = useRecallStore((s) => s.identity)

  return (
    <Modal
      onClose={closeModal}
      ariaLabel={t('identity.title')}
      className="identity-ready-modal"
      bloom={{ icon: 'activity', tone: 'magenta' }}
    >
      <div className="modal-header">
        <div className="identity-ready-heading">
          <Fingerprint size={18} strokeWidth={1.7} className="identity-ready-icon" />
          <div>
            <span className="ss-h2">{t('identity.title')}</span>
            <p className="identity-ready-sub">{t('identity.sub', { app: APP_NAME })}</p>
          </div>
        </div>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
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
          {t('identity.notNow')}
        </button>
      </div>
    </Modal>
  )
}
