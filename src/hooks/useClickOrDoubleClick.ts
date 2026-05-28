import { useCallback, useEffect, useRef } from 'react'

/**
 * Disambiguate single vs double click. Browsers fire click → click → dblclick
 * for a double-click, which would run the single-click action twice. We defer
 * the single-click action by ~240ms and cancel it when a dblclick arrives.
 */
export function useClickOrDoubleClick(
  onClick: () => void,
  onDoubleClick: () => void,
  delayMs = 240,
): { onClick: () => void; onDoubleClick: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }, [])

  const handleClick = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      onClick()
    }, delayMs)
  }, [onClick, delayMs])

  const handleDoubleClick = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    onDoubleClick()
  }, [onDoubleClick])

  return { onClick: handleClick, onDoubleClick: handleDoubleClick }
}
