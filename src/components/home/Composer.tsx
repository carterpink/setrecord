import { useEffect, useRef } from 'react'
import { Mic, AudioLines, ArrowUp, StopCircle, Lock } from 'lucide-react'

export type ComposerPhase = 'idle' | 'listening' | 'thinking'

interface ComposerProps {
  phase: ComposerPhase
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onMicToggle: () => void
  /** Live input level 0..1 while listening (from real mic capture); optional. */
  level?: number
  /** Slim variant for when the composer is docked under a live conversation. */
  compact?: boolean
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  placeholder: string
}

function NeuralField(): React.JSX.Element {
  return (
    <div className="neural" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
      <span className="blob b5" />
    </div>
  )
}

/**
 * The single neural-expressive box. Presentational — phase, value and the mic
 * are driven by HomeSurface. Drives a `--lvl` swell var so the breathing light
 * behind the box reacts to listening / thinking.
 */
export function Composer({
  phase,
  value,
  onChange,
  onSubmit,
  onMicToggle,
  level,
  compact = false,
  focused,
  onFocus,
  onBlur,
  placeholder
}: ComposerProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const rafRef = useRef(0)

  const listening = phase === 'listening'
  const thinking = phase === 'thinking'
  const ready = value.trim().length > 0 && !listening

  // Autosize the textarea. Deferred to a rAF so the first measurement happens
  // after layout (measuring at mount returns an inflated scrollHeight and the
  // box sticks at its max height).
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return undefined
    const resize = (): void => {
      ta.style.height = 'auto'
      ta.style.height = Math.min(160, ta.scrollHeight) + 'px'
    }
    const raf = requestAnimationFrame(resize)
    return () => cancelAnimationFrame(raf)
  }, [value, compact])

  // Drive the neural swell level (--lvl) on the composer root.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (listening) {
      // If a real level is supplied (mic capture), follow it; otherwise breathe.
      if (typeof level === 'number') {
        el.style.setProperty('--lvl', Math.max(0.05, Math.min(1, level)).toFixed(3))
        return
      }
      let t = 0
      const tick = (): void => {
        t += 0.08
        const v =
          0.45 + 0.3 * Math.sin(t * 2.1) + 0.18 * Math.sin(t * 5.3) + (Math.random() - 0.5) * 0.12
        el.style.setProperty('--lvl', Math.max(0.05, Math.min(1, v + 0.2)).toFixed(3))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
      return () => cancelAnimationFrame(rafRef.current)
    }
    el.style.setProperty('--lvl', thinking ? '0.55' : '0')
    return undefined
  }, [phase, listening, thinking, level])

  function keyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ready) onSubmit()
    }
  }

  return (
    <div
      ref={rootRef}
      className={`composer${compact ? ' compact' : ''}${focused ? ' focused' : ''}${listening ? ' listening' : ''}${thinking ? ' thinking' : ''}`}
      style={{ '--lvl': 0 } as React.CSSProperties}
    >
      <NeuralField />
      <div className="box">
        <div className="box-inner glass-3 box-glow">
          <div className="box-input-row">
            <textarea
              ref={taRef}
              className="box-text"
              rows={1}
              value={value}
              placeholder={listening ? '' : placeholder}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={keyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              readOnly={listening}
              aria-label="Ask your library"
            />
            <button
              type="button"
              className={`mic-btn${listening ? ' live' : ''}`}
              onClick={onMicToggle}
              title={listening ? 'Stop' : 'Speak'}
              aria-label={listening ? 'Stop listening' : 'Speak'}
            >
              {listening ? (
                <AudioLines size={18} strokeWidth={1.6} />
              ) : (
                <Mic size={18} strokeWidth={1.6} />
              )}
            </button>
            <button
              type="button"
              className={`send-btn${ready ? ' ready' : ''}`}
              onClick={() => ready && onSubmit()}
              title="Send"
              aria-label="Send"
            >
              <ArrowUp size={18} strokeWidth={1.8} />
            </button>
          </div>

          {listening ? (
            // Docked (compact) composer keeps its single-row height while listening
            // — the live mic icon already signals the state, no extra bar needed.
            compact ? null : (
              <div className="listen-bar">
                <span className="listen-state">
                  <span className="eq">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  Listening — keep going
                </span>
                <span className="stop-link" onClick={onMicToggle}>
                  <StopCircle size={13} strokeWidth={1.6} />
                  tap to stop
                </span>
              </div>
            )
          ) : compact ? null : (
            <div className="box-actions">
              <div className="box-actions-left">
                <span className="box-hint">
                  <Lock size={12} strokeWidth={1.7} />
                  Nothing leaves your Mac
                </span>
              </div>
              <span className="box-hint">
                <span className="kbd">↵</span>to send · <span className="kbd">⇧↵</span>new line
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
