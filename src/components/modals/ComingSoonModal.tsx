import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Modal } from '@/components/shared/Modal'
import { useUiStore } from '@/stores/uiStore'

interface Props {
  feature: string
  phase: number
}

export function ComingSoonModal({ feature, phase }: Props): React.JSX.Element {
  const { t } = useTranslation('modals')
  const { closeModal } = useUiStore()

  return (
    <Modal onClose={closeModal} ariaLabel={feature} maxWidth={400} style={{ textAlign: 'center' }}>
      <div className="modal-header" style={{ justifyContent: 'flex-end', paddingBottom: 0 }}>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
      </div>

      <div className="modal-body" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <div className="ss-h2" style={{ marginBottom: 8 }}>
          {feature}
        </div>
        <div className="ss-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          {t('comingSoon.body', { phase })}
        </div>
        <Button variant="secondary" onClick={closeModal}>
          {t('comingSoon.gotIt')}
        </Button>
      </div>
    </Modal>
  )
}
