interface EnergyCurveDiagramProps {
  target: number[]
  actual: number[]
  width?: number
  height?: number
}

function buildPath(values: number[], w: number, h: number, padX: number, padY: number): string {
  if (values.length === 0) return ''
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const max = 10
  const min = 0
  const step = values.length === 1 ? 0 : innerW / (values.length - 1)
  return values
    .map((v, i) => {
      const x = padX + i * step
      const y = padY + innerH - ((v - min) / (max - min)) * innerH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function EnergyCurveDiagram({
  target,
  actual,
  width = 280,
  height = 110
}: EnergyCurveDiagramProps): React.JSX.Element {
  const padX = 8
  const padY = 8
  const targetPath = buildPath(target, width, height, padX, padY)
  const actualPath = buildPath(actual, width, height, padX, padY)

  return (
    <div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Energy curve: target versus achieved across the set"
        style={{ display: 'block' }}
      >
        <title>Energy curve target vs achieved</title>
        {[2, 5, 8].map((g) => {
          const innerH = height - padY * 2
          const y = padY + innerH - (g / 10) * innerH
          return (
            <line
              key={g}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}
        {targetPath && (
          <path
            d={targetPath}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
        )}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="var(--accent-primary, #C8FF3D)"
            strokeWidth={2}
          />
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6 }}>
        <span
          className="ss-caption"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 2,
              background: 'rgba(255,255,255,0.45)',
              borderRadius: 1
            }}
          />
          Target
        </span>
        <span
          className="ss-caption"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 2,
              background: 'var(--accent-primary, #C8FF3D)',
              borderRadius: 1
            }}
          />
          Your set
        </span>
      </div>
    </div>
  )
}
