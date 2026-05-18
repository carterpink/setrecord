interface BpmRampDiagramProps {
  fromBpm: number
  toBpm: number
}

export function BpmRampDiagram({ fromBpm, toBpm }: BpmRampDiagramProps): React.JSX.Element {
  const delta = toBpm - fromBpm
  const direction = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const fmt = (n: number): string => (Math.round(n * 10) / 10).toString()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 0' }}>
      <div className="ss-mono" style={{ fontSize: 18 }}>{fmt(fromBpm)}</div>
      <svg
        width={60}
        height={20}
        viewBox="0 0 60 20"
        role="img"
        aria-label={`BPM ${direction}${fmt(Math.abs(delta))}`}
      >
        <title>BPM change: {direction}{fmt(Math.abs(delta))}</title>
        <line x1={2} y1={10} x2={50} y2={10} stroke="rgba(200,255,61,0.7)" strokeWidth={1.5} />
        <polygon points="50,5 58,10 50,15" fill="rgba(200,255,61,0.7)" />
      </svg>
      <div className="ss-mono" style={{ fontSize: 18 }}>{fmt(toBpm)}</div>
      <div
        className="ss-caption ss-mono"
        style={{
          marginLeft: 8,
          padding: '3px 8px',
          borderRadius: 6,
          background: 'rgba(200,255,61,0.12)',
          color: 'var(--accent-primary, #C8FF3D)',
        }}
      >
        {direction}{fmt(Math.abs(delta))} BPM
      </div>
    </div>
  )
}
