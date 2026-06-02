interface HarmonicWheelDiagramProps {
  fromKey: string
  toKey: string
  size?: number
}

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function parseKey(key: string): { num: number; letter: 'A' | 'B' } | null {
  const m = /^(\d{1,2})([AB])$/i.exec(key.trim())
  if (!m) return null
  return { num: parseInt(m[1], 10), letter: m[2].toUpperCase() as 'A' | 'B' }
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function HarmonicWheelDiagram({
  fromKey,
  toKey,
  size = 180
}: HarmonicWheelDiagramProps): React.JSX.Element {
  const from = parseKey(fromKey)
  const to = parseKey(toKey)
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.46
  const rInner = size * 0.3
  const rLabelOuter = (rOuter + size * 0.5) / 2 + 4
  const rLabelInner = (rInner + size * 0.05) / 2 + 12

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Camelot wheel showing ${fromKey} and ${toKey}`}
      style={{ display: 'block', margin: '0 auto' }}
    >
      <title>
        Camelot wheel: {fromKey} → {toKey}
      </title>
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      <circle
        cx={cx}
        cy={cy}
        r={rInner}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {POSITIONS.map((num) => {
        const angle = (num / 12) * 360
        const outer = polar(cx, cy, rLabelOuter, angle)
        const inner = polar(cx, cy, rLabelInner, angle)
        const outerKey = `${num}B`
        const innerKey = `${num}A`
        const isFromOuter = from?.num === num && from?.letter === 'B'
        const isToOuter = to?.num === num && to?.letter === 'B'
        const isFromInner = from?.num === num && from?.letter === 'A'
        const isToInner = to?.num === num && to?.letter === 'A'
        return (
          <g key={num}>
            <text
              x={outer.x}
              y={outer.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill={
                isFromOuter
                  ? 'var(--accent-primary, #C8FF3D)'
                  : isToOuter
                    ? 'var(--semantic-success, #6dd58c)'
                    : 'rgba(255,255,255,0.55)'
              }
              fontWeight={isFromOuter || isToOuter ? 700 : 400}
            >
              {outerKey}
            </text>
            <text
              x={inner.x}
              y={inner.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill={
                isFromInner
                  ? 'var(--accent-primary, #C8FF3D)'
                  : isToInner
                    ? 'var(--semantic-success, #6dd58c)'
                    : 'rgba(255,255,255,0.55)'
              }
              fontWeight={isFromInner || isToInner ? 700 : 400}
            >
              {innerKey}
            </text>
          </g>
        )
      })}
      {from &&
        to &&
        (() => {
          const angleFrom = (from.num / 12) * 360
          const angleTo = (to.num / 12) * 360
          const rFrom = from.letter === 'B' ? rLabelOuter - 7 : rLabelInner + 7
          const rTo = to.letter === 'B' ? rLabelOuter - 7 : rLabelInner + 7
          const pFrom = polar(cx, cy, rFrom, angleFrom)
          const pTo = polar(cx, cy, rTo, angleTo)
          return (
            <line
              x1={pFrom.x}
              y1={pFrom.y}
              x2={pTo.x}
              y2={pTo.y}
              stroke="rgba(200,255,61,0.45)"
              strokeWidth={1.2}
              strokeDasharray="2,3"
            />
          )
        })()}
    </svg>
  )
}
