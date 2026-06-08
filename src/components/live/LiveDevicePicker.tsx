import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listInputDevices, type InputDevice } from './audioFeed'
import { getPreferredInputId, setPreferredInputId } from './liveDevice'

/**
 * Compact input-device selector for SetRecord Live, shown beside "Go Live".
 * Lets the DJ point capture at their loopback/master input (e.g. BlackHole)
 * rather than the built-in mic. Device labels populate once mic permission has
 * been granted (after the first Go Live). Hidden outside Electron.
 */
export function LiveDevicePicker(): React.JSX.Element | null {
  const { t } = useTranslation('live')
  const [devices, setDevices] = useState<InputDevice[]>([])
  const [selected, setSelected] = useState<string>(getPreferredInputId() ?? '')

  useEffect(() => {
    let mounted = true
    const refresh = (): void => {
      void listInputDevices()
        .then((d) => {
          if (mounted) setDevices(d)
        })
        .catch(() => {})
    }
    refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => {
      mounted = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
    }
  }, [])

  if (typeof window.setrecord === 'undefined') return null

  return (
    <select
      value={selected}
      title={t('device.title')}
      aria-label={t('device.ariaLabel')}
      style={{
        height: 30,
        maxWidth: 150,
        padding: '0 8px',
        borderRadius: 'var(--radius-full)',
        border: '0.5px solid var(--border-default)',
        background: 'var(--surface-2)',
        color: 'var(--text-secondary)',
        font: 'var(--type-caption)',
        cursor: 'pointer'
      }}
      onChange={(e) => {
        const v = e.target.value
        setSelected(v)
        setPreferredInputId(v || undefined)
      }}
    >
      <option value="">{t('device.default')}</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label}
        </option>
      ))}
    </select>
  )
}
