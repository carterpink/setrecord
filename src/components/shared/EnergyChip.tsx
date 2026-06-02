import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Coachmark } from '@/components/learn/Coachmark'

interface EnergyChipProps {
  value: number
  isPending?: boolean
  isOverride?: boolean
  editable?: boolean
  onChange?: (value: number) => void
  className?: string
}

export function EnergyChip({
  value,
  isPending,
  isOverride,
  editable,
  onChange,
  className
}: EnergyChipProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const chipRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent): void => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [editing])

  const adjust = (delta: number, e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    const next = Math.max(1, Math.min(10, value + delta))
    onChange?.(next)
  }

  if (isPending) {
    return (
      <span
        className={clsx('nrg-chip nrg-chip--pending', className)}
        title="Energy: analysing…"
        aria-label="Energy pending"
      >
        ?
      </span>
    )
  }

  if (editable && editing) {
    return (
      <span
        ref={chipRef}
        className={clsx(
          'nrg-chip nrg-chip--editing',
          isOverride && 'nrg-chip--override',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        aria-label={`Energy ${value} of 10, editable`}
      >
        <button
          type="button"
          className="nrg-adj"
          aria-label="Decrease energy"
          disabled={value <= 1}
          onMouseDown={(e) => adjust(-1, e)}
        >
          −
        </button>
        <span className="nrg-val">{value}</span>
        <button
          type="button"
          className="nrg-adj"
          aria-label="Increase energy"
          disabled={value >= 10}
          onMouseDown={(e) => adjust(1, e)}
        >
          +
        </button>
      </span>
    )
  }

  return (
    <Coachmark concept="energy">
      <span
        ref={chipRef}
        className={clsx(
          'nrg-chip',
          editable && 'nrg-chip--clickable',
          isOverride && 'nrg-chip--override',
          className
        )}
        title={isOverride ? `Energy: ${value}/10 (manually set)` : `Energy: ${value}/10`}
        aria-label={`Energy ${value} of 10`}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onClick={(e) => {
          if (!editable) return
          e.stopPropagation()
          setEditing(true)
        }}
        onKeyDown={(e) => {
          if (!editable) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            setEditing(true)
          }
        }}
      >
        {value}
      </span>
    </Coachmark>
  )
}
