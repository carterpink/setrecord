import clsx from 'clsx'

interface RangeSliderProps {
  min: number
  max: number
  step?: number
  low: number
  high: number
  onChange: (low: number, high: number) => void
  formatLabel?: (v: number) => string
  className?: string
}

export function RangeSlider({
  min,
  max,
  step = 1,
  low,
  high,
  onChange,
  formatLabel,
  className
}: RangeSliderProps): React.JSX.Element {
  const range = max - min
  const lowPct = range === 0 ? 0 : ((low - min) / range) * 100
  const highPct = range === 0 ? 100 : ((high - min) / range) * 100

  function handleLow(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = Math.min(Number(e.target.value), high - step)
    onChange(v, high)
  }

  function handleHigh(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = Math.max(Number(e.target.value), low + step)
    onChange(low, v)
  }

  // When low handle is pushed to the maximum, raise its z-index so it can still be dragged left
  const lowZ = low >= max - step ? 5 : 3
  const highZ = 4

  return (
    <div className={clsx('range-slider', className)}>
      <div className="range-wrapper">
        {/* Visual track */}
        <div className="range-track" />
        {/* Chartreuse fill between handles */}
        <div className="range-fill" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
        {/* Low handle — pointer-events on thumb only, not the track */}
        <input
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={handleLow}
          style={{ zIndex: lowZ }}
        />
        {/* High handle */}
        <input
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={handleHigh}
          style={{ zIndex: highZ }}
        />
      </div>
      <div className="range-labels ss-mono">
        <span>{formatLabel ? formatLabel(low) : low}</span>
        <span>{formatLabel ? formatLabel(high) : high}</span>
      </div>
    </div>
  )
}
