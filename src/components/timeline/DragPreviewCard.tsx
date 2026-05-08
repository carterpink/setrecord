import { KeyChip } from '@/components/shared/KeyChip'
import { formatBpm } from '@/utils/format'
import type { Track, SetTrack } from '@/types'

type Props =
  | { source: 'library'; track: Track }
  | { source: 'timeline'; setTrack: SetTrack }

export function DragPreviewCard(props: Props): React.JSX.Element {
  const track = props.source === 'library' ? props.track : props.setTrack.track

  return (
    <div className="tl-drag-preview glass-2" style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(200,255,61,0.35)',
      minWidth: 260,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artist}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {formatBpm(track.bpm)}
      </div>
      <KeyChip>{track.key}</KeyChip>
    </div>
  )
}
