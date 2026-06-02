import clsx from 'clsx'

interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  className?: string
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 1,
  onChange,
  className
}: SliderProps): React.JSX.Element {
  const normalized = max === min ? 0 : (value - min) / (max - min)
  const pct = `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`

  return (
    <div className={clsx('slider', className)} style={{ position: 'relative' }}>
      <div className="fill" style={{ width: pct }} />
      <div className="knob" style={{ left: pct }} />
      {onChange && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            margin: 0
          }}
        />
      )}
    </div>
  )
}
